using UnrealBuildTool;

public class Quebec : ModuleRules
{
    public Quebec(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new[] { "Core", "CoreUObject", "Engine", "InputCore", "NetCore" });
        PrivateDependencyModuleNames.Add("PixelStreaming2");
    }
}
