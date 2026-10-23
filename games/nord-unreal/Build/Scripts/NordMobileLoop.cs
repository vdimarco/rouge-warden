// NORD mobile gauntlet: the RunUnreal test node for one run of the phone-stream loop
// (openspec/changes/nord-mobile-gauntlet). Scripts/gauntlet_loop.py builds the -test= argument:
//
//   RunUAT.sh RunUnreal -project=<Quebec.uproject> -ScriptsForProject=<Quebec.uproject> -platform=Linux
//     -configuration=Development -build=<Builds/Browser/Linux>
//     -test="NordMobileLoop(mode=perf,size=1412x652,sky=night-rain,laps=1,run='<run dir>',execcmds='<file>',expect='<file>')"
//
// Parameters: mode (perf, look or stream), size (WxH), sky (day or night_rain, '-' or '_'), laps, run (absolute run
// folder), execcmds (a file read verbatim into -ExecCmds=) or deviceprofile (a -DeviceProfile= name), expect (the
// -NordGauntletExpect= file; without it, <execcmds file>.expect when that exists) and maxduration (seconds before
// Gauntlet stops the client; Scripts/gauntlet_loop.py run_timeout). The flags match Scripts/gauntlet_loop.py
// direct_command, so a RunUnreal run and a --direct run start the same game.
//
// The game does the work (Source/Quebec/QuebecGauntlet.cpp); this node only launches it with the right flags and
// keeps its files. It was written from memory of the UE 5.x Gauntlet API and never compiled, because the cloud
// container has no dotnet. Every engine API that may differ on the host is marked "unverified".
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using Gauntlet;

namespace NordGauntlet.Automation
{
    public class NordMobileLoop : UnrealTestNode<UnrealTestConfiguration>
    {
        // Data/Gauntlet/loop.json: map, skies (args), world_flags and the look-run flag.
        const string Map = "/Game/Maps/LaFontaine";
        static readonly Dictionary<string, string> SkyArgs = new Dictionary<string, string>
        {
            { "day", "-NordHour=15 -NordWeather=Clear -NordFreezeTime -NordFreezeWeather" },
            { "night_rain", "-NordHour=22 -NordWeather=Rain -NordFreezeTime -NordFreezeWeather" },
        };
        const string WorldFlags = "-NordNoPolice -NordNoCampaign -NordNoSideJobs -NordNoCampaignSave";
        const string LookFlags = "-NordNoAmbient";

        // The default MaxDuration, for a -test= typed by hand: the game's own limits, so Gauntlet never stops the client
        // before the game reports and writes its CSV. The load is gauntlet_loop.py LOAD_S (an estimate); the others are
        // Data/Gauntlet/loop.json modes, drive.max_lap_s and run_limits. gauntlet_loop.py passes the same sum as maxduration.
        const float LoadSeconds = 180;
        const float ReadyGraceSeconds = 60;
        const float LapSeconds = 360;
        const float StillsTimeoutSeconds = 90;
        const float CsvWaitSeconds = 30;
        const int StopCount = 5;
        static readonly Dictionary<string, (float Delay, int WarmLaps, float Hold)> Modes = new Dictionary<string, (float Delay, int WarmLaps, float Hold)>
        {
            { "perf", (10, 1, 0) },
            { "look", (10, 0, 24) },
            { "stream", (95, 1, 4) },
        };

        string RunDir;

        public NordMobileLoop(UnrealTestContext InContext) : base(InContext)
        {
        }

        public override UnrealTestConfiguration GetConfiguration()
        {
            UnrealTestConfiguration Config = base.GetConfiguration();
            string Mode = Value("mode", "perf").ToLowerInvariant();
            string Size = Value("size", "1412x652").ToLowerInvariant();
            string Sky = Value("sky", "night_rain").ToLowerInvariant().Replace('-', '_');
            string ExecCmdsFile = Value("execcmds", "");
            string ExpectFile = Value("expect", "");
            string DeviceProfile = Value("deviceprofile", "");
            RunDir = Value("run", "");
            if (!Modes.ContainsKey(Mode))
            {
                throw new ArgumentException($"NordMobileLoop: mode must be perf, look or stream, not '{Mode}'");
            }
            string[] Sides = Size.Split('x');
            if (Sides.Length != 2 || !int.TryParse(Sides[0], out int Width) || !int.TryParse(Sides[1], out int Height))
            {
                throw new ArgumentException($"NordMobileLoop: size must be <width>x<height>, not '{Size}'");
            }
            if (!SkyArgs.ContainsKey(Sky))
            {
                throw new ArgumentException($"NordMobileLoop: sky must be day or night_rain, not '{Sky}'");
            }
            if (!int.TryParse(Value("laps", "1"), out int Laps) || Laps < 1)
            {
                throw new ArgumentException("NordMobileLoop: laps must be 1 or more");
            }
            if (string.IsNullOrEmpty(RunDir) || !Path.IsPathRooted(RunDir))
            {
                throw new ArgumentException("NordMobileLoop: run must be an absolute folder (Saved/Gauntlet/<UTC>-<label>)");
            }
            float MaxDuration = DefaultMaxDuration(Mode, Laps);
            string MaxText = Value("maxduration", "");
            if (MaxText.Length > 0 && (!float.TryParse(MaxText, NumberStyles.Float, CultureInfo.InvariantCulture, out MaxDuration) || MaxDuration <= 0))
            {
                throw new ArgumentException($"NordMobileLoop: maxduration must be a positive number of seconds, not '{MaxText}'");
            }
            Directory.CreateDirectory(Path.Combine(RunDir, "native"));

            List<string> Args = new List<string>
            {
                "-RenderOffscreen", "-windowed", "-ForceRes", $"-ResX={Width}", $"-ResY={Height}", "-unattended", "-nosound",
                "-csvGpuStats", "-csvCompression=0",
                "-NordGauntlet", $"-NordGauntletMode={Mode}", $"-NordGauntletRun=\"{RunDir}\"", $"-NordGauntletLaps={Laps}",
                SkyArgs[Sky], WorldFlags,
                $"-abslog=\"{Path.Combine(RunDir, "native", "game.log")}\"",
            };
            if (Mode == "look")
            {
                Args.Add(LookFlags);
            }
            if (!string.IsNullOrEmpty(DeviceProfile))
            {
                Args.Add($"-DeviceProfile={DeviceProfile}");
            }
            if (!string.IsNullOrEmpty(ExecCmdsFile))
            {
                // Scripts/gauntlet_tune.py writes <id>.execcmds (one line, used verbatim) and <id>.expect beside it.
                Args.Add($"-ExecCmds=\"{File.ReadAllText(ExecCmdsFile).Trim()}\"");
                if (string.IsNullOrEmpty(ExpectFile) && File.Exists(Path.ChangeExtension(ExecCmdsFile, ".expect")))
                {
                    ExpectFile = Path.ChangeExtension(ExecCmdsFile, ".expect");
                }
            }
            if (!string.IsNullOrEmpty(ExpectFile))
            {
                Args.Add($"-NordGauntletExpect=\"{ExpectFile}\"");
            }

            UnrealTestRole Client = Config.RequireRole(UnrealTargetRole.Client);
            Client.MapOverride = Map; // unverified property name
            Client.CommandLine += " " + string.Join(" ", Args); // unverified: newer engines also have CommandLineParams
            Client.Controllers.Add("QuebecGauntletController");
            Config.MaxDuration = MaxDuration; // unverified: seconds as a float
            Log.Info("NordMobileLoop: mode={0} size={1}x{2} sky={3} laps={4} run={5} max_duration_s={6}", Mode, Width, Height, Sky, Laps, RunDir, MaxDuration);
            return Config;
        }

        // A look hold may last until its stills time out, so it counts at the stills timeout.
        static float DefaultMaxDuration(string Mode, int Laps)
        {
            (float Delay, int WarmLaps, float Hold) = Modes[Mode];
            float HoldLimit = Mode == "look" ? Math.Max(Hold, StillsTimeoutSeconds) : Hold;
            return LoadSeconds + Delay + ReadyGraceSeconds + (WarmLaps + Laps) * LapSeconds + StopCount * HoldLimit + CsvWaitSeconds;
        }

        public override void StopTest(StopReason InReason) // unverified signature
        {
            base.StopTest(InReason);
            try
            {
                CopyRunFiles();
            }
            catch (Exception Error)
            {
                Log.Warning("NordMobileLoop: could not copy run files: {0}", Error.Message);
            }
        }

        // The game writes its CSV and stills straight into the run folder. If the engine put them in its default
        // folders instead, Gauntlet's saved client artifacts hold them, so copy whatever the run folder lacks.
        void CopyRunFiles()
        {
            if (string.IsNullOrEmpty(RunDir))
            {
                return;
            }
            foreach (UnrealRoleArtifacts Artifacts in SessionArtifacts ?? Enumerable.Empty<UnrealRoleArtifacts>()) // unverified names
            {
                if (string.IsNullOrEmpty(Artifacts.ArtifactPath) || !Directory.Exists(Artifacts.ArtifactPath))
                {
                    continue;
                }
                CopyMissing(Artifacts.ArtifactPath, "*.csv*", Path.Combine(RunDir, "native"));
                CopyMissing(Artifacts.ArtifactPath, "*.png", Path.Combine(RunDir, "look", "engine"));
            }
        }

        static void CopyMissing(string FromDir, string Pattern, string ToDir)
        {
            foreach (string Source in Directory.EnumerateFiles(FromDir, Pattern, SearchOption.AllDirectories))
            {
                string Target = Path.Combine(ToDir, Path.GetFileName(Source));
                if (File.Exists(Target))
                {
                    continue;
                }
                Directory.CreateDirectory(ToDir);
                File.Copy(Source, Target);
                Log.Info("NordMobileLoop: copied {0} to {1}", Source, Target);
            }
        }

        // A -test= parameter without the quotes RunUnreal may leave on it.
        string Value(string Name, string Default)
        {
            return (Context.TestParams.ParseValue(Name, Default) ?? Default).Trim().Trim('\'', '"'); // unverified: Params.ParseValue
        }
    }
}
