using UnrealBuildTool;

public class Quebec : ModuleRules
{
    public Quebec(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new[] { "Core", "CoreUObject", "Engine", "InputCore", "NetCore" });
        PrivateDependencyModuleNames.AddRange(new[] { "PixelStreaming2", "PixelStreaming2Core", "AnimGraphRuntime" });
    }
}
