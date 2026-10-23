# Offline UE 5.8 checker for the Quebec module

These scripts check the C++ in `games/nord-unreal/Source/Quebec` without an Unreal Engine
install. `check.sh` compiles every `.cpp` with clang against hand-written stub headers.
`link.sh` finds game functions that are called but never defined. `selftest.sh` shows that
both scripts reject known-bad code.

The stubs were written from memory of the UE 5.x API. No Epic source was downloaded or
copied. A passing check means the code is very likely to compile in UE. It does not prove it.

## Quick start

```sh
STUBS=/path/to/uestubs              # this folder
$STUBS/check.sh                     # every .cpp in Source/Quebec, game configuration
$STUBS/check.sh --both              # game (WITH_EDITOR=0) and editor (WITH_EDITOR=1) configurations
$STUBS/check.sh Source/Quebec/QuebecDrive.cpp   # selected files only
$STUBS/link.sh --both               # declared-and-called-but-never-defined game functions
$STUBS/selftest.sh                  # the checkers still catch known mistakes
```

Requirements: `clang++` (tested with clang 18.1.3), `python3`, `bash` 4 or later, and
`nm`/`c++filt` from binutils for `link.sh`. Set `QUEBEC_SRC` or pass `--src DIR` to check
another module directory. `check.sh -h` and `link.sh -h` list every option.

Each file prints `PASS` or `FAIL`, followed by clang's diagnostics. A summary line comes
last. The exit status is non-zero when any file fails or when UHT reports an error.

## What `check.sh` does

1. **UHT emulation (`uht.py`).** It scans every header in the module and writes
   `<File>.generated.h` into a temporary directory. A copy is kept in
   `generated/<Module>/` for inspection. Like the real UHT, it defines `CURRENT_FILE_ID` and
   one `FID_<path>_<line>_GENERATED_BODY` macro for each `GENERATED_BODY()` line. Each
   macro declares the following members:
   - `Super`, `ThisClass` and `StaticClass()`, or `StaticStruct()` for a USTRUCT
   - private copy and move constructors
   - the default `FObjectInitializer` constructor when the class declares none
   - the `_Implementation` and `_Validate` functions of RPCs and BlueprintNativeEvents,
     with default arguments removed
   - one marker for each `Replicated`/`ReplicatedUsing` property, which `DOREPLIFETIME` checks
   - a constexpr list of the class's UFUNCTIONs, which `AddDynamic` and `BindDynamic` check

   UENUMs get `StaticEnum<>`, `TIsUEnumClass` and `FOREACH_ENUM_*` support. The script also
   writes `uht_manifest.json` for `link.sh`.

   It reports these errors, which the real UHT also reports:
   - `.generated.h` is not the last include, or has the wrong name
   - `GENERATED_BODY` is missing
   - a class or struct has the wrong A/U/F prefix
   - a UFUNCTION is overloaded, or declared in a USTRUCT
   - an RPC has no Reliable/Unreliable, returns a value, takes a non-const reference, or is static
   - a BlueprintNativeEvent or BlueprintImplementableEvent is declared virtual
   - a property has two visibility specifiers, or both BlueprintReadWrite and BlueprintReadOnly
   - a private property uses Blueprint access without `AllowPrivateAccess`
   - a Blueprint property has a type Blueprint does not support
   - a container is nested inside another container
   - a struct member is replicated
   - the function named in `ReplicatedUsing` is missing
   - a `BlueprintType` enum class is not `uint8`
2. **Compilation.** Each `.cpp` is checked with
   `clang++ -std=c++20 -fsyntax-only -DWITH_EDITOR=0 -DWITH_DEV_AUTOMATION_TESTS=1 -DUE_BUILD_SHIPPING=0 -DQUEBEC_API=`
   and UE's Linux clang warning set, so it fails on the same warnings UE fails on:
   `-Wall -Werror -Wshadow -Wdelete-non-virtual-dtor -Wenum-conversion -Wbitfield-enum-conversion`
   plus the `-Wno-*` list in `check.sh`. `--editor` uses `WITH_EDITOR=1 WITH_EDITORONLY_DATA=1`,
   and `--both` runs both configurations.
3. **Shared PCH, as UBT applies it.** `Quebec.Build.cs` uses
   `PCHUsage = UseExplicitOrSharedPCHs` and has no private PCH. UBT therefore force-includes
   the Engine shared PCH into every file. `check.sh` reads `PCHUsage` from the Build.cs and
   force-includes `include/EngineSharedPCH.h`. That stub contains only the headers the real
   shared PCH is believed to contain. `--no-pch` checks each file without it, the way UBT
   builds with `-NoPCH -DisableUnity`. Use it as an include-what-you-use report.
4. **Module gating, as UBT applies it.** Core, CoreUObject, Engine, InputCore and NetCore
   headers are in `include/`. Headers of optional modules are in `modules/<Module>/`. They are
   on the include path only when the Build.cs lists the module, or when a listed module
   depends on it publicly. Stubs exist for AnimGraphRuntime, PixelStreaming2,
   PixelStreaming2Core, AIModule, NavigationSystem and Gauntlet. If you add a module to the Build.cs,
   add its stubs under `modules/`. Until then, its headers are reported as "file not found".

Several runs can share the folder safely, because each run generates into its own temporary
directory.

## What the stubs catch

- Wrong names, misspelled members and wrong argument types or counts. Engine classes keep
  their real hierarchy, constness, default arguments and access levels. For example,
  `AActor::BeginPlay` and `RootComponent` are protected, and UObject copy constructors are
  private.
- `-Wshadow` on locals that hide members of the same class. Globals that real code
  can shadow are stubbed too: `GEngine`, `GIsEditor`, `GFrameCounter`, `GLog`, `GConfig`.
- Missing includes beyond what the shared PCH provides. Headers forward-declare the same
  types the real headers do. For example, `Character.h` does not make
  `UCharacterMovementComponent` complete. `--no-pch` turns this into a strict check.
- `override` on a function that is not virtual, or on a signature that does not match.
- Engine bases do not declare virtual overloads that UE does not have, so
  `-Woverloaded-virtual` reports the same problems UE reports.
- Printf-style format strings in `UE_LOG`, `UE_CLOG`, `FString::Printf`, `checkf` and
  `ensureMsgf`, checked at compile time. Passing an `FString` to `%s` produces an error
  named `Error_PercentS_needs_a_TCHAR_pointer__pass_STAR_MyFString_not_the_FString`.
- An undeclared log category or a misspelled verbosity.
- `AddDynamic` and `BindDynamic`:
  - the handler must match the delegate's exact parameter list
  - the handler must be a UFUNCTION; UE compiles that mistake and fails at runtime
- `DOREPLIFETIME` on a property that is not marked `Replicated`. UE only reports this at
  runtime.
- Misuse of `SetTimer`, `BindAxis`, `BindAction`, `BindKey`, delegate `Create*`/`Bind*` and
  `AddLambda` signatures.
- `Cast<>` on a type that is not a UObject.
- `SpawnActor<T>`, `CreateDefaultSubobject<T>`, `NewObject<T>` and `TWeakObjectPtr<T>` with a
  `T` of the wrong kind.
- Copying a `TArray` of move-only elements.
- `TArray`, `TMap`, `TSet` and `Sort`/`FindByPredicate`/`RemoveAll` evaluate their
  predicates and hash functions, so element and predicate types are type-checked.
- Containers, smart pointers and delegates work with anonymous-namespace and local types.
  Every stub template member has a body, so clang's `-Wundefined-internal` does not fire.

## What it cannot check

- **Signatures are from memory.** An API that is missing or wrong in the stubs shows up as
  a false error. Fix the stub, not the game. A wrong but permissive stub can also hide a
  real error. See "Uncertain APIs" below.
- **No real link.** `link.sh` checks only that game symbols are defined. Engine symbols are
  stub declarations, so a call to an engine function that is not exported (`*_API`) is not
  caught.
- **Reflection is approximate.** `uht.py` parses headers with regular expressions and
  reports only the errors listed above. It does not check metadata, `meta=` keys,
  Blueprint-only rules, `UPROPERTY` types inside nested templates, or
  `GENERATED_UCLASS_BODY` details. It does not generate `.gen.cpp` code.
- **The PCH and include graph are approximate.** The shared PCH contents and each stub
  header's transitive includes come from memory. Unity builds, which can hide missing
  includes, are not emulated. Each file is compiled on its own, the way adaptive unity
  compiles changed files.
- **Only Linux and clang are covered.** MSVC-only diagnostics such as C4458 and C4668 are
  not checked. `TCHAR` is `char16_t`, as on UE Linux.
- **Nothing runs.** Only compilation is checked. There is no behaviour, asset or
  config-file check. `ConstructorHelpers` paths and `LoadObject` paths are not resolved.
- **Lenient on purpose:**
  - legacy math macros (`SMALL_NUMBER`, `KINDA_SMALL_NUMBER`) and other deprecated APIs
    compile, because the flags include `-Wno-deprecated-declarations`
  - `StaticEnum<T>` compiles for any enum
  - `TFunction` accepts a move-only functor (see below)

## `link.sh`

```sh
$STUBS/link.sh            # game configuration
$STUBS/link.sh --both     # game and editor configurations
$STUBS/link.sh --keep /tmp/objs   # keep the .o files
```

`link.sh` runs `check.sh --obj-dir` to compile every module `.cpp` to an object file at `-O0`.
`nm` then collects each object's undefined symbols and every object's global defined
symbols. It reports each symbol that no object defines and that belongs to the game module.
A symbol belongs to the game module when its outermost scope, or the free function's own
name, contains `Quebec`, `LaFontaine` or `CollegeBathurst`. That covers `AQuebec*`,
`UQuebec*`, `FQuebec*` and the namespaces `QuebecPeople`, `QuebecCombat`, `QuebecCrime`,
`QuebecJobs`, `QuebecNotice` and `QuebecTraces`.

Members that the real UHT defines in `.gen.cpp` are skipped:
- `StaticClass`, `StaticStruct`, `StaticEnum` and `GetPrivateStaticClass`
- the RPC, BlueprintNativeEvent and BlueprintImplementableEvent thunks, read from
  `uht_manifest.json`
- `exec*`, `Execute_*`, `Z_Construct*` and `*_DelegateWrapper`
- the default `FObjectInitializer` constructor of a class without a user constructor
- the private copy and move constructors

What remains is a function or static member that is declared and called but defined nowhere.
For example: a definition was forgotten, a signature differs between the `.h` and the
`.cpp`, an `_Implementation` is missing, or a template is defined in another `.cpp`. The
host link fails on each of these.

A virtual function that is declared but never defined also shows up, either by name or as
`vtable for AQuebecX`.

Exit status:

| Status | Meaning |
| --- | --- |
| 0 | Nothing is missing. |
| 1 | A game symbol is missing. |
| 2 | A file did not compile, so its definitions are missing from the check. |

## `selftest.sh`

Each case in `selftest/cases` is checked as its own one-module project. Its first
`// EXPECT:` line is either `PASS` or a regular expression that must appear in the failing
output. `// MODULES:` adds Build.cs dependencies. `// LINK-EXPECT:` and `// LINK-REJECT:`
also run the case through `link.sh`.

| Case | Expected result |
| --- | --- |
| OkActor, ApiCoverage, ApiCoverage2, InternalTypes | Compile cleanly. Together they exercise traces, sweeps, overlaps, spawning, damage, sound, physics and ragdoll, character movement, input, HUD and canvas, timers, replication, math, containers, Kismet libraries, AI and navigation, async, Algo, console variables, and anonymous types in containers. |
| ShadowField | A local shadows a field of an AActor subclass. |
| WrongArgType | `SetActorLocation(FRotator)`. |
| MisspelledMethod | `SetSimulatePhysic` on a `UPrimitiveComponent`. |
| LogFString | `%s` with an `FString`. |
| MissingInclude | A `UCharacterMovementComponent` member is used without its header. |
| OverlapSignature | An overlap handler has the wrong parameter list. |
| NotUFunction | `AddDynamic` targets a function that is not a UFUNCTION. |
| RpcReliability | A UFUNCTION(Server) has no Reliable or Unreliable. |
| RepNotReplicated | `DOREPLIFETIME` on a property that is not replicated. |
| CopyMoveOnly | Copies a `TArray<TUniquePtr<>>`. |
| ModuleNotListed | Includes an AIModule header that the Build.cs does not list. |
| LinkMissing | Compiles, but `link.sh` must report a namespace function, a member function and a virtual function that are never defined. It must not report the RPC thunk or `StaticClass`. |
| GauntletOk | Compiles cleanly: a Gauntlet test controller that starts and ends a CSV profiler capture, adds CSV events and metadata, spawns a camera actor, waits for texture streaming and takes a screenshot. |
| GauntletOverride | `OnPostMapChange` overridden with the wrong parameter. |
| GauntletNotListed | Includes `GauntletTestController.h` while the Build.cs does not list Gauntlet. |
| CsvEventFString | `CSV_EVENT_GLOBAL` with an `FString` for `%s`. |

## Layout

| Path | Contents |
| --- | --- |
| `check.sh` | The compile check. |
| `link.sh` | The link check. |
| `selftest.sh` | The self-tests. |
| `uht.py` | Mini Unreal Header Tool. |
| `include/` | Stubs of Core, CoreUObject, Engine, InputCore and NetCore, at the paths the real headers have. `include/UEStub/` holds the shared implementation: core types, templates, containers, strings, math, delegates, logging and UObject. Most public headers include those files. |
| `include/EngineSharedPCH.h` | Stub of the shared PCH. |
| `modules/<Module>/` | Stubs of optional modules, visible only through the Build.cs. |
| `selftest/cases/` | The self-test cases. |
| `tools/add_template_bodies.py` | Gives every declared-only member of a class template a stub body. Run it on a new stub header that declares templates. |
| `generated/<Module>/` | Copy of the last UHT output. |

When code needs an engine API that the stubs lack, add it to the matching header with the
real signature: same constness, same default arguments, same access level. Do not add
catch-all variadic templates.

## Current results (2026-10-23, Source/Quebec with 47 .cpp files)

| Check | Result |
| --- | --- |
| `check.sh --both` | Every file passes in both the game and the editor configuration, including all `*Tests.cpp`. No test file is failing. |
| `link.sh --both` | Every used game symbol is defined, in both configurations. |
| `selftest.sh` | 21 checks pass, 0 unexpected. |
| `check.sh --no-pch` | 46 files pass and 1 fails: `QuebecVegetation.cpp` names `UMaterialInterface` in a nested name specifier without its header, so it compiles only through the shared PCH. |

## Uncertain APIs

These stubs follow the game code or a best recollection. Check them first if a real build
disagrees.

- **`TFunction` accepts a move-only functor.** `Quebec.cpp` passes a lambda that captures
  the `TUniquePtr` returned by `TextBiDi::CreateTextBiDi()` to
  `FTSTicker::AddTicker(const TCHAR*, float, TFunction<bool(float)>)`. I expected UE's
  `TFunction` to require a copyable functor. However, `Verification/AutomationQuebec.json`
  shows that this test ran on LinuxEditor, so the stub does not check copyability. One of
  these three recollections is wrong: the `TFunction` copy rule, the `CreateTextBiDi`
  return type, or the `AddTicker` signature.
- **`FBlendSample::bMirror`** was added because the game tests read it. The other fields
  (`bUseSingleFrameForBlending`, `FrameIndexToSample`) are from memory.
- **Return types:**
  - `UStaticMeshComponent::GetStaticMesh()` returns `TObjectPtr<UStaticMesh>`
  - `UWorld::TimeSeconds` and the related time fields are `double` and public
  - `EGuidFormats` is an `enum class`
- **Array conversion:** `TArray<TObjectPtr<T>>` converts implicitly to `TArray<T*>&` and
  `const TArray<T*>&`, through `TContainerElementTypeCompatibility`.
- **Access levels:**
  - `UAnimInstance::GetRequiredBones()` is public
  - `AController::OnPossess` and `OnUnPossess` are public in the stubs; they may be protected in UE
  - `UProjectileMovementComponent::HandleImpact` is public
- **Animation details:**
  - the `FAnimExtractContext(double, bool, FDeltaTimeRecord, bool)` constructor
  - `UAnimSequence::GetBoneTransform(FTransform&, FSkeletonPoseBoneIndex, const FAnimExtractContext&, bool)`
  - `FCompactPose`, `FBlendedCurve` and `UE::Anim::FStackAttributeContainer`, declared
    only as far as the tests use them
- **`AUTORTFM_DISABLE_IF(...)`** is an empty macro.
- **The contents of `EngineSharedPCH.h`.** If a header is missing from it, `check.sh`
  reports a false error. If it lists a header the real PCH does not contain, a real
  missing-include error is hidden.
- **Newer helper stubs**, added for future gameplay code and lightly used so far:
  - `UKismetMathLibrary` and `UKismetSystemLibrary`, which use `double` parameters after
    Large World Coordinates (LWC)
  - `USplineComponent`, whose distances are `float`
  - `UProjectileMovementComponent`
  - `IConsoleManager`
  - `Async`, `ParallelFor` and `Algo::*`
  - `AGameMode` and `AGameState`
  - `AAIController`, `UNavigationSystemV1` and `FNavLocation`. `FNavLocation` converts
    implicitly to `FVector`.
  - the AIModule's public dependency on NavigationSystem
- **NORD mobile gauntlet stubs** (2026-10-23), written from memory and not yet checked against a UE 5.8 build:
  - `ProfilingDebugging/CsvProfiler.h`: `FCsvProfiler::Get`, `BeginCapture(int, const FString&, const FString&,
    ECsvProfilerFlags)`, `EndCapture(FGraphEventRef)` returning `TSharedFuture<FString>`, `IsCapturing`,
    `CSV_EVENT_GLOBAL`, `CSV_METADATA`, and `CSV_PROFILER` as `WITH_ENGINE && !UE_BUILD_SHIPPING`
  - `modules/Gauntlet/GauntletTestController.h`: the plugin and module name `Gauntlet`, the `On*` hooks as protected
    virtuals, `EndTest(int32)` and `GetFirstPlayerController`
  - `FPlatformMisc::RequestExitWithStatus(bool, uint8, const TCHAR*)`
  - `Camera/CameraActor.h` and `HAL/FileManager.h`, as far as the game uses them
  - `ContentStreaming.h`: `IStreamingManager::Get()` returning `FStreamingManagerCollection&`, and its
    `StreamAllResources(float)`
  - `FGraphEventRef` is a `TSharedPtr` here; UE uses a `TRefCountPtr`
