using System.Text.Json;
using PixelCreatures.Core;
using PixelCreatures.Core.Export;
using PixelCreatures.Core.Serialization;

var output = Path.GetFullPath(args.Length > 0 ? args[0] : "public/arcade/creatures/assets");
Directory.CreateDirectory(output);
var registry = CreatureRegistry.CreateDefault();
registry.DiscoverExtensions(typeof(CreatureRegistry).Assembly);
var factory = new CreatureFactory(registry);
var serializer = new GenomeSerializer(registry);
var families = new[] { "quadruped", "biped", "reptile", "arthropod", "winged", "serpent", "aquatic", "amorphous", "plantfolk" };
foreach (var family in families)
foreach (var seed in new ulong[] { 101, 202 })
{
    var id = $"{family}-{seed}";
    var genome = GenomeFactory.Sample(registry.GetFamily(family), seed);
    var model = factory.Build(genome);
    var result = SpritesheetExporter.Export(model, registry, new SpritesheetOptions {
        Fps = 6, Quality = 1, DrawShadow = false, MaxPageSize = 2048,
        Clips = new() { ClipKind.Idle, ClipKind.Walk, ClipKind.Action, ClipKind.Hit },
    }, id);
    File.WriteAllText(Path.Combine(output, id + ".json"), result.MetadataJson);
    File.WriteAllText(Path.Combine(output, id + ".genome.json"), serializer.Serialize(genome));
    for (int p = 0; p < result.Pages.Count; p++)
    {
        var page = result.Pages[p];
        var filename = result.Pages.Count == 1 ? id + ".png" : $"{id}_{p}.png";
        File.WriteAllBytes(Path.Combine(output, filename), PngEncoder.Encode(page.rgba, page.width, page.height));
    }
    Console.WriteLine($"Exported {id}: {result.TotalFrames} frames, {result.Pages.Count} pages");
}
File.WriteAllText(Path.Combine(output, "provenance.json"), JsonSerializer.Serialize(new {
    source = "https://github.com/idlerunner00/procedural-pixel-creatures",
    commit = "24d26df10e9f0d369f1caf5b6ba0e8e724ec0888",
    generatorVersion = CreatureFramework.GeneratorVersion,
    frameworkVersion = CreatureFramework.FrameworkVersion,
    families, seeds = new[] { 101, 202 }, fps = 6,
}, new JsonSerializerOptions { WriteIndented = true }));
