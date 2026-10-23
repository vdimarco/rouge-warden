using UnrealBuildTool;

// NORD mobile gauntlet: the Gauntlet test controller for Build/Scripts/NordMobileLoop.cs, in its own module. Shipping
// leaves the Gauntlet plugin out, and Quebec.uproject denies this module in Shipping, so the header tool never parses
// a controller whose parent class it cannot find. The controller meets UQuebecGauntletSubsystem only through console
// variables, so this module needs no Quebec header. The Gauntlet module name is unverified until the host builds it.
public class QuebecGauntletTest : ModuleRules
{
    public QuebecGauntletTest(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PrivateDependencyModuleNames.AddRange(new[] { "Core", "CoreUObject", "Engine", "Gauntlet" });
    }
}
