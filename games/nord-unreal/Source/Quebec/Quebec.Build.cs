using UnrealBuildTool;

public class Quebec : ModuleRules
{
    public Quebec(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new[] { "Core", "CoreUObject", "Engine", "InputCore", "NetCore" });
        PrivateDependencyModuleNames.AddRange(new[] { "PixelStreaming2", "PixelStreaming2Core", "AnimGraphRuntime" });
        // NORD mobile gauntlet: QuebecGauntletController.cpp needs the Gauntlet plugin's module, which test builds use
        // and Shipping leaves out. The module name is unverified until the host builds it.
        bool bWithGauntlet = Target.Configuration != UnrealTargetConfiguration.Shipping;
        if (bWithGauntlet) PrivateDependencyModuleNames.Add("Gauntlet");
        PrivateDefinitions.Add("QUEBEC_WITH_GAUNTLET=" + (bWithGauntlet ? "1" : "0"));
    }
}
