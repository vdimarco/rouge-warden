"""Dependency warnings must reject otherwise successful rendered captures."""
from render_log_guard import assert_render_log_clean


assert assert_render_log_clean('LogInit: Display: Engine initialized\nPLATEAU_CAPTURE_OK\n')['passed']
failures = [
    'LoadErrors: While trying to load package /Game/Plateau/Materials/MI_LeNeuvilleRoof, a dependent package /Game/Plateau/Materials/M_LeNeuvilleRoofParent was not available.',
    'LogLinker: Warning: A dependent package /Game/Example was not available.',
    'FPackageName: Skipped package /Game/Example has a valid mounted mount point but does not exist on disk or in iostore.',
    'LogMaterial: Warning: Missing cached shader map for material Roof, compiling.',
    'LogLinker: Warning: Failed to load /Game/Plateau/Materials/Roof',
    'LogLinker: Warning: Unable to load /Game/Plateau/Materials/Roof',
    "LogStreaming: Error: Couldn't find file for package /Game/Plateau/Roof",
    'LogMaterial: Warning: Failed to compile Material /Game/Plateau/Roof',
    'Fatal error: Assertion failed: NumRefs >= 0',
    'VulkanRHI: VK_ERROR_OUT_OF_DEVICE_MEMORY',
]
for line in failures:
    try:
        assert_render_log_clean('PLATEAU_CAPTURE_OK\n' + line)
    except AssertionError:
        pass
    else:
        raise AssertionError('Rendered evidence accepted a real failure: ' + line)
print('Render log guard: clean case passes; ten dependency/shader/fatal cases reject')
