// Offline UE 5.x API stub: CoreUObject module (reflection macros, UObject, UClass, TObjectPtr,
// TSubclassOf, Cast, NewObject, LoadObject, property reflection).
#pragma once
#include "CoreMinimal.h"

// ---------------------------------------------------------------- reflection macros (UHT markup)
#define UCLASS(...)
#define USTRUCT(...)
#define UENUM(...)
#define UINTERFACE(...)
#define UPROPERTY(...)
#define UFUNCTION(...)
#define UMETA(...)
#define UPARAM(...)
#define UDELEGATE(...)
#define RIGVM_METHOD(...)
#define BODY_MACRO_COMBINE_INNER(A, B, C, D) A##B##C##D
#define BODY_MACRO_COMBINE(A, B, C, D) BODY_MACRO_COMBINE_INNER(A, B, C, D)
#define GENERATED_BODY(...) BODY_MACRO_COMBINE(CURRENT_FILE_ID, _, __LINE__, _GENERATED_BODY)
#define GENERATED_BODY_LEGACY(...) BODY_MACRO_COMBINE(CURRENT_FILE_ID, _, __LINE__, _GENERATED_BODY_LEGACY)
#define GENERATED_UCLASS_BODY(...) GENERATED_BODY_LEGACY()
#define GENERATED_USTRUCT_BODY(...) GENERATED_BODY()
#define GENERATED_UINTERFACE_BODY(...) GENERATED_BODY_LEGACY()
#define GENERATED_IINTERFACE_BODY(...) GENERATED_BODY_LEGACY()
#define UE_DEPRECATED_MACRO(Version, Message)
#define RELAY_CONSTRUCTOR(TClass, TSuperClass) TClass(const FObjectInitializer& ObjectInitializer) : TSuperClass(ObjectInitializer) {}
#define WITH_METADATA 0

// ---------------------------------------------------------------- object flags
enum EObjectFlags
{
    RF_NoFlags = 0x00000000,
    RF_Public = 0x00000001,
    RF_Standalone = 0x00000002,
    RF_MarkAsNative = 0x00000004,
    RF_Transactional = 0x00000008,
    RF_ClassDefaultObject = 0x00000010,
    RF_ArchetypeObject = 0x00000020,
    RF_Transient = 0x00000040,
    RF_MarkAsRootSet = 0x00000080,
    RF_TagGarbageTemp = 0x00000100,
    RF_NeedInitialization = 0x00000200,
    RF_NeedLoad = 0x00000400,
    RF_KeepForCooker = 0x00000800,
    RF_NeedPostLoad = 0x00001000,
    RF_NeedPostLoadSubobjects = 0x00002000,
    RF_NewerVersionExists = 0x00004000,
    RF_BeginDestroyed = 0x00008000,
    RF_FinishDestroyed = 0x00010000,
    RF_BeingRegenerated = 0x00020000,
    RF_DefaultSubObject = 0x00040000,
    RF_WasLoaded = 0x00080000,
    RF_TextExportTransient = 0x00100000,
    RF_LoadCompleted = 0x00200000,
    RF_InheritableComponentTemplate = 0x00400000,
    RF_DuplicateTransient = 0x00800000,
    RF_StrongRefOnFrame = 0x01000000,
    RF_NonPIEDuplicateTransient = 0x02000000,
    RF_WillBeLoaded = 0x08000000,
    RF_HasExternalPackage = 0x10000000,
    RF_AllocatedInSharedPage = 0x80000000,
    RF_AllFlags = 0x7fffffff,
};
ENUM_CLASS_FLAGS(EObjectFlags)
enum ELoadFlags
{
    LOAD_None = 0x00000000,
    LOAD_Async = 0x00000001,
    LOAD_NoWarn = 0x00000002,
    LOAD_EditorOnly = 0x00000004,
    LOAD_ResolvingDeferredExports = 0x00000008,
    LOAD_Verify = 0x00000010,
    LOAD_NoVerify = 0x00000080,
    LOAD_IsVerifying = 0x00000100,
    LOAD_SkipLoadImportedPackages = 0x00000200,
    LOAD_DisableDependencyPreloading = 0x00001000,
    LOAD_Quiet = 0x00002000,
    LOAD_FindIfFail = 0x00004000,
    LOAD_MemoryReader = 0x00008000,
    LOAD_NoRedirects = 0x00010000,
    LOAD_ForDiff = 0x00020000,
    LOAD_PackageForPIE = 0x00080000,
    LOAD_DeferDependencyLoads = 0x00100000,
    LOAD_ForFileDiff = 0x00200000,
    LOAD_DisableCompileOnLoad = 0x00400000,
    LOAD_DisableEngineVersionChecks = 0x00800000,
};
enum ERenameFlags { REN_None = 0x0000, REN_ForceNoResetLoaders = 0x0001, REN_Test = 0x0002, REN_DoNotDirty = 0x0004, REN_DontCreateRedirectors = 0x0010, REN_NonTransactional = 0x0020, REN_ForceGlobalUnique = 0x0040, REN_SkipGeneratedClasses = 0x0080 };
enum EClassFlags { CLASS_None = 0, CLASS_Abstract = 0x00000001, CLASS_Native = 0x00000080, CLASS_Deprecated = 0x02000000, CLASS_NewerVersionExists = 0x80000000 };
ENUM_CLASS_FLAGS(EClassFlags)
enum class EInternalObjectFlags : int32 { None = 0, Garbage = 1 << 21, RootSet = 1 << 30, PendingKill = 1 << 29 };
ENUM_CLASS_FLAGS(EInternalObjectFlags)
namespace ECastCheckedType { enum Type { NullAllowed, NullChecked }; }
enum class EGetObjectsWithOuterFlags : int32 { None = 0, IncludeNestedObjects = 1 };

class UObject;
class UClass;
class UStruct;
class UScriptStruct;
class UEnum;
class UFunction;
class UPackage;
class UWorld;
class FProperty;
class FField;
class FArchive;
struct FFrame;
class FObjectInitializer;
class FVTableHelper;
struct FLifetimeProperty;
class FOutputDevice;
class UPackageMap;
struct FLinkerInstancingContext;
struct FObjectInstancingGraph;
struct FPropertyChangedEvent;
struct FPropertyChangedChainEvent;
class FReferenceCollector;
class IInterface;
class UInterface;

#define UESTUB_UCLASS_BODY(TClass, TSuperClass) \
public: \
    typedef TSuperClass Super; \
    typedef TClass ThisClass; \
    static UClass* StaticClass(); \
private: \
    TClass(TClass&&); \
    TClass(const TClass&); \
public:

// ---------------------------------------------------------------- FObjectInitializer
class FObjectInitializer
{
public:
    FObjectInitializer();
    ~FObjectInitializer();
    static FObjectInitializer& Get();
    UObject* GetObj() const;
    UClass* GetClass() const;
    UObject* GetArchetype() const;
    template <class TReturnType> TReturnType* CreateDefaultSubobject(UObject* Outer, FName SubobjectName, bool bTransient = false) const { (void)&TReturnType::StaticClass; return nullptr; }
    template <class TReturnType, class TClassToConstructByDefault> TReturnType* CreateDefaultSubobject(UObject* Outer, FName SubobjectName, bool bTransient = false) const { (void)&TClassToConstructByDefault::StaticClass; return nullptr; }
    template <class TReturnType> TReturnType* CreateOptionalDefaultSubobject(UObject* Outer, FName SubobjectName, bool bTransient = false) const { (void)&TReturnType::StaticClass; return nullptr; }
    template <class TReturnType> TReturnType* CreateEditorOnlyDefaultSubobject(UObject* Outer, FName SubobjectName, bool bTransient = false) const { (void)&TReturnType::StaticClass; return nullptr; }
    template <class T> FObjectInitializer const& SetDefaultSubobjectClass(FName SubobjectName) const { (void)&T::StaticClass; return *this; }
    FObjectInitializer const& DoNotCreateDefaultSubobject(FName SubobjectName) const;
    FObjectInitializer const& SetNestedDefaultSubobjectClass(FName SubobjectName, UClass* Class) const;
    FObjectInitializer(const FObjectInitializer&) = delete;
    FObjectInitializer& operator=(const FObjectInitializer&) = delete;
};
class FVTableHelper { public: FVTableHelper(); };

// ---------------------------------------------------------------- UObject hierarchy
class UObjectBase
{
public:
    virtual ~UObjectBase();
    uint32 GetUniqueID() const;
    UClass* GetClass() const;
    UObject* GetOuter() const;
    FName GetFName() const;
    EObjectFlags GetFlags() const;
    bool IsValidLowLevel() const;
    bool IsValidLowLevelFast(bool bRecursive = true) const;
    UPackage* GetExternalPackage() const;
protected:
    UObjectBase();
};

class UObjectBaseUtility : public UObjectBase
{
public:
    void SetFlags(EObjectFlags NewFlags);
    void ClearFlags(EObjectFlags NewFlags);
    bool HasAnyFlags(EObjectFlags FlagsToCheck) const;
    bool HasAllFlags(EObjectFlags FlagsToCheck) const;
    void MarkAsGarbage();
    void ClearGarbage();
    void AddToRoot();
    void RemoveFromRoot();
    bool IsRooted() const;
    bool IsUnreachable() const;
    bool IsNative() const;
    bool HasAnyInternalFlags(EInternalObjectFlags FlagsToCheck) const;
    FString GetFullName(const UObject* StopOuter = nullptr) const;
    FString GetPathName(const UObject* StopOuter = nullptr) const;
    FString GetName() const;
    void GetName(FString& ResultString) const;
    bool IsTemplate(EObjectFlags TemplateTypes = RF_ArchetypeObject | RF_ClassDefaultObject) const;
    UObject* GetTypedOuter(UClass* Target) const;
    template <typename T> T* GetTypedOuter() const;
    template <typename InterfaceClassType> InterfaceClassType* GetImplementingOuter() const;
    UPackage* GetOutermost() const;
    UPackage* GetPackage() const;
    UObject* GetOutermostObject() const;
    bool MarkPackageDirty() const;
    bool IsIn(const UObject* SomeOuter) const;
    bool IsInOuter(const UObject* SomeOuter) const;
    bool IsInPackage(const UPackage* SomePackage) const;
    bool IsA(const UClass* SomeBase) const;
    template <class T> bool IsA() const { (void)&T::StaticClass; return true; }
    bool IsSelected() const;
    bool RootPackageHasAnyFlags(uint32 CheckFlagMask) const;
    void DetachExternalPackage();
};

class UObject : public UObjectBaseUtility
{
public:
    typedef UObject Super;
    typedef UObject ThisClass;
    static UClass* StaticClass();
    UObject();
    UObject(const FObjectInitializer& ObjectInitializer);
    UObject(FVTableHelper& Helper);
    virtual ~UObject();

    template <class TReturnType> TReturnType* CreateDefaultSubobject(FName SubobjectName, bool bTransient = false)
    { static_assert(std::is_base_of_v<UObject, TReturnType>, "CreateDefaultSubobject: type must be a UObject"); (void)&TReturnType::StaticClass; return nullptr; }
    template <class TReturnType, class TClassToConstructByDefault> TReturnType* CreateDefaultSubobject(FName SubobjectName, bool bTransient = false)
    { static_assert(std::is_base_of_v<TReturnType, TClassToConstructByDefault>, "CreateDefaultSubobject: default class must derive from the return type"); (void)&TClassToConstructByDefault::StaticClass; return nullptr; }
    template <class TReturnType> TReturnType* CreateOptionalDefaultSubobject(FName SubobjectName, bool bTransient = false)
    { (void)&TReturnType::StaticClass; return nullptr; }
    template <class TReturnType> TReturnType* CreateEditorOnlyDefaultSubobject(FName SubobjectName, bool bTransient = false)
    { (void)&TReturnType::StaticClass; return nullptr; }
    UObject* CreateDefaultSubobject(FName SubobjectFName, UClass* ReturnType, UClass* ClassToCreateByDefault, bool bIsRequired, bool bIsTransient);
    void GetDefaultSubobjects(TArray<UObject*>& OutDefaultSubobjects);
    UObject* GetDefaultSubobjectByName(FName ToFind);

    virtual void PostInitProperties();
    virtual void PostReinitProperties();
    virtual void PostCDOContruct();
    virtual void PostLoad();
    virtual void PostLoadSubobjects(FObjectInstancingGraph* OuterInstanceGraph);
    virtual void BeginDestroy();
    virtual bool IsReadyForFinishDestroy();
    virtual void FinishDestroy();
    virtual void Serialize(FArchive& Ar);
    virtual void ShutdownAfterError();
    virtual void PostInterpChange(FProperty* PropertyThatChanged);
    virtual void PostDuplicate(bool bDuplicateForPIE);
    virtual bool NeedsLoadForClient() const;
    virtual bool NeedsLoadForServer() const;
    virtual bool IsPostLoadThreadSafe() const;
    virtual bool Modify(bool bAlwaysMarkDirty = true);
    virtual bool Rename(const TCHAR* NewName = nullptr, UObject* NewOuter = nullptr, ERenameFlags Flags = REN_None);
    virtual FString GetDesc();
    virtual UWorld* GetWorld() const;
    bool ImplementsGetWorld() const;
    virtual bool IsSupportedForNetworking() const;
    virtual bool IsNameStableForNetworking() const;
    virtual bool IsFullNameStableForNetworking() const;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const;
    virtual void PreNetReceive();
    virtual void PostNetReceive();
    virtual void PostRepNotifies();
    virtual void PreDestroyFromReplication();
    virtual void ProcessEvent(UFunction* Function, void* Parms);
    virtual int32 GetFunctionCallspace(UFunction* Function, FFrame* Stack);
    virtual bool CallRemoteFunction(UFunction* Function, void* Parms, struct FOutParmRec* OutParms, FFrame* Stack);
    virtual bool IsAsset() const;
    virtual bool IsEditorOnly() const;
    virtual bool IsLocalizedResource() const;
    virtual bool IsSafeForRootSet() const;
    UFunction* FindFunction(FName InName) const;
    UFunction* FindFunctionChecked(FName InName) const;
    bool CallFunctionByNameWithArguments(const TCHAR* Cmd, FOutputDevice& Ar, UObject* Executor, bool bForceCallWithNonExec = false);
    void SaveConfig(uint64 RequiredPropertyFlags = 0, const TCHAR* Filename = nullptr);
    void LoadConfig(UClass* ConfigClass = nullptr, const TCHAR* Filename = nullptr, uint32 PropagationFlags = 0, FProperty* PropertyToLoad = nullptr);
    void ReloadConfig(UClass* ConfigClass = nullptr, const TCHAR* Filename = nullptr, uint32 PropagationFlags = 0, FProperty* PropertyToLoad = nullptr);
    bool ConditionalBeginDestroy();
    bool ConditionalFinishDestroy();
    void ConditionalPostLoad();
    bool IsDefaultSubobject() const;
    bool IsInBlueprint() const;
    bool AreAllOuterObjectsValid() const;
    FName GetDefaultConfigFilename() const;
    static void AddReferencedObjects(UObject* InThis, FReferenceCollector& Collector);
#if WITH_EDITOR
    virtual void PreEditChange(FProperty* PropertyAboutToChange);
    virtual void PostEditChangeProperty(FPropertyChangedEvent& PropertyChangedEvent);
    virtual void PostEditChangeChainProperty(FPropertyChangedChainEvent& PropertyChangedEvent);
    virtual bool CanEditChange(const FProperty* InProperty) const;
    virtual void PostEditUndo();
#endif
private:
    UObject(UObject&&);
    UObject(const UObject&);
};

class UField : public UObject { UESTUB_UCLASS_BODY(UField, UObject) UField(); };
class UStruct : public UField
{
    UESTUB_UCLASS_BODY(UStruct, UField)
    UStruct();
    UStruct* GetSuperStruct() const;
    bool IsChildOf(const UStruct* SomeBase) const;
    template <class T> bool IsChildOf() const { return IsChildOf(T::StaticClass()); }
    FProperty* FindPropertyByName(FName InName) const;
    int32 GetPropertiesSize() const;
    int32 GetStructureSize() const;
    FString GetAuthoredName() const;
    FProperty* PropertyLink;
};
class UScriptStruct : public UStruct
{
    UESTUB_UCLASS_BODY(UScriptStruct, UStruct)
    UScriptStruct();
    void InitializeStruct(void* Dest, int32 ArrayDim = 1) const;
    void DestroyStruct(void* Dest, int32 ArrayDim = 1) const;
    void CopyScriptStruct(void* Dest, void const* Src, int32 ArrayDim = 1) const;
    bool CompareScriptStruct(const void* A, const void* B, uint32 PortFlags) const;
};
class UFunction : public UStruct
{
    UESTUB_UCLASS_BODY(UFunction, UStruct)
    UFunction();
    uint32 FunctionFlags;
    uint8 NumParms;
    uint16 ParmsSize;
    uint16 ReturnValueOffset;
    bool HasAnyFunctionFlags(uint32 FlagsToCheck) const;
    FProperty* GetReturnProperty() const;
};
namespace EGetByNameFlags { enum Type { None = 0, ErrorIfNotFound = 1, CaseSensitive = 2, CheckAuthoredName = 4 }; }
class UEnum : public UField
{
    UESTUB_UCLASS_BODY(UEnum, UField)
    UEnum();
    enum class ECppForm { Regular, Namespaced, EnumClass };
    FName GetNameByIndex(int32 Index) const;
    FName GetNameByValue(int64 InValue) const;
    FString GetNameStringByIndex(int32 InIndex) const;
    FString GetNameStringByValue(int64 InValue) const;
    FText GetDisplayNameTextByIndex(int32 InIndex) const;
    FText GetDisplayNameTextByValue(int64 InValue) const;
    int64 GetValueByIndex(int32 Index) const;
    int64 GetValueByName(FName InName, EGetByNameFlags::Type Flags = EGetByNameFlags::None) const;
    int64 GetValueByNameString(const FString& SearchString, EGetByNameFlags::Type Flags = EGetByNameFlags::None) const;
    int32 GetIndexByValue(int64 InValue) const;
    int32 GetIndexByName(FName InName, EGetByNameFlags::Type Flags = EGetByNameFlags::None) const;
    int32 NumEnums() const;
    int64 GetMaxEnumValue() const;
    bool IsValidEnumValue(int64 InValue) const;
    FString GetMetaData(const TCHAR* Key, int32 NameIndex = INDEX_NONE, bool bAllowRemap = true) const;
    template <typename EnumType> static FString GetValueAsString(const EnumType EnumeratorValue);
    template <typename EnumType> static void GetValueAsString(const EnumType EnumeratorValue, FString& out_StringValue);
    template <typename EnumType> static FName GetValueAsName(const EnumType EnumeratorValue);
    template <typename EnumType> static FText GetDisplayValueAsText(const EnumType EnumeratorValue);
    template <typename EnumType> static FString GetDisplayValueAsText(const EnumType EnumeratorValue, FText& out_TextValue);
};
class UClass : public UStruct
{
    UESTUB_UCLASS_BODY(UClass, UStruct)
    UClass();
    UObject* GetDefaultObject(bool bCreateIfNeeded = true) const;
    template <class T> T* GetDefaultObject() const { (void)&T::StaticClass; return nullptr; }
    UClass* GetSuperClass() const;
    bool HasAnyClassFlags(EClassFlags FlagsToCheck) const;
    bool HasAllClassFlags(EClassFlags FlagsToCheck) const;
    UFunction* FindFunctionByName(FName InName, int32 IncludeSuper = 1) const;
    bool ImplementsInterface(const UClass* SomeInterface) const;
    UObject* ClassDefaultObject;
    EClassFlags ClassFlags;
    FString GetDescription() const;
    bool IsFunctionImplementedInScript(FName InFunctionName) const;
};
class UPackage : public UObject
{
    UESTUB_UCLASS_BODY(UPackage, UObject)
    UPackage();
    void SetDirtyFlag(bool bIsDirty);
    bool IsDirty() const;
    void FullyLoad();
    bool IsFullyLoaded() const;
    FName GetLoadedPath() const;
};
class UInterface : public UObject { UESTUB_UCLASS_BODY(UInterface, UObject) UInterface(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get()); };
class IInterface
{
protected:
    virtual ~IInterface() {}
public:
    typedef UInterface UClassType;
};

UPackage* GetTransientPackage();
UObject* GetTransientPackageAsObject();
UPackage* CreatePackage(const TCHAR* PackageName);
UPackage* FindPackage(UObject* InOuter, const TCHAR* PackageName);
UPackage* LoadPackage(UPackage* InOuter, const TCHAR* InLongPackageName, uint32 LoadFlags, FArchive* InReaderOverride = nullptr, const FLinkerInstancingContext* InstancingContext = nullptr);
void CollectGarbage(EObjectFlags KeepFlags, bool bPerformFullPurge = true);
bool IsGarbageCollecting();
bool IsAsyncLoading();
void FlushAsyncLoading(int32 PackageID = INDEX_NONE);

template <class T> UClass* StaticClass() { return T::StaticClass(); }
template <class T> UScriptStruct* StaticStruct() { return T::StaticStruct(); }
// UHT emits an explicit specialization of StaticEnum for every UENUM; other enums have none.
template <typename T> UEnum* StaticEnum() { return ::UEStub::Fake<UEnum*>(); }
// Templates/IsUEnumClass.h: UHT specializes this for every UENUM enum class.
template <typename T> struct TIsUEnumClass { enum { Value = false }; };
template <typename T> UScriptStruct* TBaseStructure_Get() { return ::UEStub::Fake<UScriptStruct*>(); }
template <typename T> struct TBaseStructure { static UScriptStruct* Get(); };

// ---------------------------------------------------------------- TObjectPtr
template <typename T>
class TObjectPtr
{
public:
    using ElementType = T;
    TObjectPtr() = default;
    TObjectPtr(const TObjectPtr&) = default;
    TObjectPtr& operator=(const TObjectPtr&) = default;
    TObjectPtr(TYPE_OF_NULLPTR) {}
    template <typename U, std::enable_if_t<std::is_convertible_v<U*, T*>, int> = 0>
    TObjectPtr(U* Object) {}
    template <typename U, std::enable_if_t<std::is_convertible_v<U*, T*> && !std::is_same_v<U, T>, int> = 0>
    TObjectPtr(const TObjectPtr<U>& Other) {}
    TObjectPtr& operator=(TYPE_OF_NULLPTR) { return *this; }
    template <typename U, std::enable_if_t<std::is_convertible_v<U*, T*>, int> = 0>
    TObjectPtr& operator=(U* Object) { return *this; }
    template <typename U, std::enable_if_t<std::is_convertible_v<U*, T*> && !std::is_same_v<U, T>, int> = 0>
    TObjectPtr& operator=(const TObjectPtr<U>& Other) { return *this; }

    T* Get() const { return ::UEStub::Fake<T*>(); }
    operator T*() const { return Get(); }
    explicit operator bool() const { return ::UEStub::Fake<bool>(); }
    T* operator->() const { return ::UEStub::Fake<T*>(); }
    T& operator*() const { return ::UEStub::Fake<T&>(); }
    bool IsNull() const { return ::UEStub::Fake<bool>(); }
    bool IsResolved() const { return ::UEStub::Fake<bool>(); }
    UClass* GetClass() const { return ::UEStub::Fake<UClass*>(); }
    FName GetFName() const { return ::UEStub::Fake<FName>(); }
    FString GetName() const { return ::UEStub::Fake<FString>(); }
    FString GetPathName() const { return ::UEStub::Fake<FString>(); }
    FString GetFullName() const { return ::UEStub::Fake<FString>(); }
    uint32 GetPtrTypeHash() const { return ::UEStub::Fake<uint32>(); }

    template <typename U> friend bool operator==(const TObjectPtr& Lhs, const TObjectPtr<U>& Rhs) { return Lhs.Get() == Rhs.Get(); }
    template <typename U, std::enable_if_t<!std::is_same_v<std::remove_cv_t<U>, TObjectPtr>, int> = 0>
    friend bool operator==(const TObjectPtr& Lhs, U* Rhs) { return Lhs.Get() == Rhs; }
    friend bool operator==(const TObjectPtr& Lhs, TYPE_OF_NULLPTR) { return !Lhs; }
};
template <typename T> uint32 GetTypeHash(const TObjectPtr<T>& InObjectPtr) { return ::UEStub::Fake<uint32>(); }
template <typename T> T* ToRawPtr(const TObjectPtr<T>& Ptr) { return Ptr.Get(); }
template <typename T> T* ToRawPtr(T* Ptr) { return Ptr; }
template <typename T, typename A> const TArray<T*, A>& ToRawPtrTArrayUnsafe(const TArray<TObjectPtr<T>, A>& Array) { return ::UEStub::Fake<const TArray<T*, A>&>(); }
template <typename T> TObjectPtr<T> MakeObjectPtrUnsafe(const UObject* Obj) { return ::UEStub::Fake<TObjectPtr<T>>(); }

template <typename T>
class TStrongObjectPtr
{
public:
    TStrongObjectPtr() {}
    explicit TStrongObjectPtr(T* InObject) {}
    T* Get() const { return ::UEStub::Fake<T*>(); }
    T* operator->() const { return ::UEStub::Fake<T*>(); }
    T& operator*() const { return ::UEStub::Fake<T&>(); }
    explicit operator bool() const { return ::UEStub::Fake<bool>(); }
    bool IsValid() const { return ::UEStub::Fake<bool>(); }
    void Reset(T* InNewObject = nullptr) {}
};

template <class InterfaceType>
class TScriptInterface
{
public:
    TScriptInterface() {}
    TScriptInterface(TYPE_OF_NULLPTR) {}
    template <class U> TScriptInterface(U* Source) {}
    UObject* GetObject() const { return ::UEStub::Fake<UObject*>(); }
    InterfaceType* GetInterface() const { return ::UEStub::Fake<InterfaceType*>(); }
    InterfaceType* operator->() const { return ::UEStub::Fake<InterfaceType*>(); }
    InterfaceType& operator*() const { return ::UEStub::Fake<InterfaceType&>(); }
    explicit operator bool() const { return ::UEStub::Fake<bool>(); }
    void SetObject(UObject* InObjectPointer) {}
    void SetInterface(InterfaceType* InInterfacePointer) {}
};

// ---------------------------------------------------------------- TSubclassOf
template <class T>
class TSubclassOf
{
public:
    using ElementType = T;
    TSubclassOf() = default;
    TSubclassOf(TYPE_OF_NULLPTR) {}
    TSubclassOf(UClass* From) {}
    TSubclassOf(const TObjectPtr<UClass>& From) {}
    template <class U, std::enable_if_t<std::is_convertible_v<U*, T*>, int> = 0> TSubclassOf(const TSubclassOf<U>& Other) {}
    TSubclassOf& operator=(UClass* From) { return *this; }
    template <class U, std::enable_if_t<std::is_convertible_v<U*, T*>, int> = 0> TSubclassOf& operator=(const TSubclassOf<U>& Other) { return *this; }
    UClass* operator*() const { return ::UEStub::Fake<UClass*>(); }
    UClass* Get() const { return ::UEStub::Fake<UClass*>(); }
    UClass* operator->() const { return ::UEStub::Fake<UClass*>(); }
    operator UClass*() const { return Get(); }
    T* GetDefaultObject() const { return ::UEStub::Fake<T*>(); }
};

template <class T>
class TSoftObjectPtr;
struct FSoftObjectPath
{
    FSoftObjectPath();
    FSoftObjectPath(const FString& Path);
    FSoftObjectPath(const TCHAR* Path);
    FSoftObjectPath(const UObject* InObject);
    FString ToString() const;
    FString GetAssetPathString() const;
    FString GetAssetName() const;
    FString GetLongPackageName() const;
    bool IsValid() const;
    bool IsNull() const;
    bool IsAsset() const;
    void Reset();
    UObject* TryLoad() const;
    UObject* ResolveObject() const;
    bool operator==(const FSoftObjectPath& Other) const;
};
struct FSoftClassPath : public FSoftObjectPath
{
    using FSoftObjectPath::FSoftObjectPath;
    UClass* TryLoadClass() const;
    template <class T> UClass* TryLoadClass() const;
    UClass* ResolveClass() const;
};
template <class T>
class TSoftObjectPtr
{
public:
    TSoftObjectPtr() {}
    TSoftObjectPtr(TYPE_OF_NULLPTR) {}
    TSoftObjectPtr(const FSoftObjectPath& ObjectPath) {}
    template <class U, std::enable_if_t<std::is_convertible_v<U*, T*>, int> = 0> TSoftObjectPtr(U* Object) {}
    template <class U, std::enable_if_t<std::is_convertible_v<U*, T*>, int> = 0> TSoftObjectPtr(const TObjectPtr<U>& Object) {}
    void Reset() {}
    T* Get() const { return ::UEStub::Fake<T*>(); }
    T* LoadSynchronous() const { return ::UEStub::Fake<T*>(); }
    bool IsValid() const { return ::UEStub::Fake<bool>(); }
    bool IsNull() const { return ::UEStub::Fake<bool>(); }
    bool IsPending() const { return ::UEStub::Fake<bool>(); }
    const FSoftObjectPath& ToSoftObjectPath() const { return ::UEStub::Fake<const FSoftObjectPath&>(); }
    FString ToString() const { return ::UEStub::Fake<FString>(); }
    FString GetAssetName() const { return ::UEStub::Fake<FString>(); }
    FString GetLongPackageName() const { return ::UEStub::Fake<FString>(); }
    T* operator->() const { return ::UEStub::Fake<T*>(); }
    T& operator*() const { return ::UEStub::Fake<T&>(); }
    explicit operator bool() const { return ::UEStub::Fake<bool>(); }
    bool operator==(const TSoftObjectPtr& Rhs) const { return ::UEStub::Fake<bool>(); }
};
template <class T>
class TSoftClassPtr
{
public:
    TSoftClassPtr() {}
    TSoftClassPtr(TYPE_OF_NULLPTR) {}
    TSoftClassPtr(const FSoftObjectPath& ObjectPath) {}
    TSoftClassPtr(UClass* From) {}
    void Reset() {}
    UClass* Get() const { return ::UEStub::Fake<UClass*>(); }
    UClass* LoadSynchronous() const { return ::UEStub::Fake<UClass*>(); }
    bool IsValid() const { return ::UEStub::Fake<bool>(); }
    bool IsNull() const { return ::UEStub::Fake<bool>(); }
    bool IsPending() const { return ::UEStub::Fake<bool>(); }
    const FSoftObjectPath& ToSoftObjectPath() const { return ::UEStub::Fake<const FSoftObjectPath&>(); }
    FString ToString() const { return ::UEStub::Fake<FString>(); }
    FString GetAssetName() const { return ::UEStub::Fake<FString>(); }
    explicit operator bool() const { return ::UEStub::Fake<bool>(); }
};
template <class T> class TLazyObjectPtr { public: T* Get() const; bool IsValid() const; void Reset(); };

// ---------------------------------------------------------------- casts
template <typename From, typename To>
using TCopyQualifiersFromTo_T = std::conditional_t<std::is_const_v<From>, std::conditional_t<std::is_volatile_v<From>, const volatile To, const To>, std::conditional_t<std::is_volatile_v<From>, volatile To, To>>;

namespace UEStub
{
    template <typename T> constexpr bool IsCastable = std::is_base_of_v<UObject, std::remove_cv_t<T>> || std::is_base_of_v<IInterface, std::remove_cv_t<T>>;
}
template <typename To, typename From>
TCopyQualifiersFromTo_T<From, To>* Cast(From* Src)
{
    static_assert(sizeof(From) > 0 && sizeof(To) > 0, "Attempting to cast between incomplete types");
    static_assert(UEStub::IsCastable<From>, "Attempting to use Cast<> on a type that is not a UObject or an Interface");
    static_assert(UEStub::IsCastable<To>, "Attempting to use Cast<> to a type that is not a UObject or an Interface");
    return nullptr;
}
template <typename To, typename From>
TCopyQualifiersFromTo_T<From, To>* Cast(const TObjectPtr<From>& Src) { return Cast<To>(Src.Get()); }
template <typename To, typename From>
TCopyQualifiersFromTo_T<From, To>* ExactCast(From* Src) { return Cast<To>(Src); }
template <typename To, typename From>
TCopyQualifiersFromTo_T<From, To>* ExactCast(const TObjectPtr<From>& Src) { return Cast<To>(Src.Get()); }
template <typename To, typename From>
TCopyQualifiersFromTo_T<From, To>* CastChecked(From* Src, ECastCheckedType::Type CheckType = ECastCheckedType::NullChecked) { return Cast<To>(Src); }
template <typename To, typename From>
TCopyQualifiersFromTo_T<From, To>* CastChecked(const TObjectPtr<From>& Src, ECastCheckedType::Type CheckType = ECastCheckedType::NullChecked) { return Cast<To>(Src.Get()); }
template <typename To, typename From>
TCopyQualifiersFromTo_T<From, To>* Cast(const TWeakObjectPtr<From>& Src) = delete;
template <class T, class U> T* CastField(U* Src) { return ::UEStub::Fake<T*>(); }
template <class T, class U> T* CastFieldChecked(U* Src) { return ::UEStub::Fake<T*>(); }

bool IsValid(const UObject* Test);
template <typename T> bool IsValid(const TObjectPtr<T>& Test) { return IsValid(Test.Get()); }
bool IsValidChecked(const UObject* Test);
FString GetNameSafe(const UObject* Object);
FString GetPathNameSafe(const UObject* Object);
FString GetFullNameSafe(const UObject* Object);

// ---------------------------------------------------------------- object creation and loading
template <class T>
T* NewObject(UObject* Outer = GetTransientPackageAsObject())
{ static_assert(std::is_base_of_v<UObject, T>, "NewObject: T must be a UObject"); (void)&T::StaticClass; return nullptr; }
template <class T>
T* NewObject(UObject* Outer, FName Name, EObjectFlags Flags = RF_NoFlags, UObject* Template = nullptr, bool bCopyTransientsFromClassDefaults = false, FObjectInstancingGraph* InInstanceGraph = nullptr)
{ static_assert(std::is_base_of_v<UObject, T>, "NewObject: T must be a UObject"); (void)&T::StaticClass; return nullptr; }
template <class T>
T* NewObject(UObject* Outer, const UClass* Class, FName Name = NAME_None, EObjectFlags Flags = RF_NoFlags, UObject* Template = nullptr, bool bCopyTransientsFromClassDefaults = false, FObjectInstancingGraph* InInstanceGraph = nullptr, UPackage* ExternalPackage = nullptr)
{ static_assert(std::is_base_of_v<UObject, T>, "NewObject: T must be a UObject"); (void)&T::StaticClass; return nullptr; }
UObject* StaticConstructObject_Internal(const struct FStaticConstructObjectParameters& Params);
UObject* StaticDuplicateObject(UObject const* SourceObject, UObject* DestOuter, const FName DestName = NAME_None, EObjectFlags FlagMask = RF_AllFlags, UClass* DestClass = nullptr);
template <class T> T* DuplicateObject(T const* SourceObject, UObject* Outer, const FName Name = NAME_None) { (void)&T::StaticClass; return nullptr; }
template <class T> T* DuplicateObject(const TObjectPtr<T>& SourceObject, UObject* Outer, const FName Name = NAME_None) { (void)&T::StaticClass; return nullptr; }

UObject* StaticLoadObject(UClass* Class, UObject* InOuter, const TCHAR* Name, const TCHAR* Filename = nullptr, uint32 LoadFlags = LOAD_None, UPackageMap* Sandbox = nullptr, bool bAllowObjectReconciliation = true, const FLinkerInstancingContext* InstancingContext = nullptr);
UClass* StaticLoadClass(UClass* BaseClass, UObject* InOuter, const TCHAR* Name, const TCHAR* Filename = nullptr, uint32 LoadFlags = LOAD_None, UPackageMap* Sandbox = nullptr);
UObject* StaticFindObject(UClass* Class, UObject* InOuter, const TCHAR* Name, bool ExactClass = false);
UObject* StaticFindObjectFast(UClass* Class, UObject* InOuter, FName InName, bool ExactClass = false);
template <class T> T* LoadObject(UObject* Outer, const TCHAR* Name, const TCHAR* Filename = nullptr, uint32 LoadFlags = LOAD_None, UPackageMap* Sandbox = nullptr, const FLinkerInstancingContext* InstancingContext = nullptr)
{ (void)&T::StaticClass; return nullptr; }
template <class T> UClass* LoadClass(UObject* Outer, const TCHAR* Name, const TCHAR* Filename = nullptr, uint32 LoadFlags = LOAD_None, UPackageMap* Sandbox = nullptr)
{ (void)&T::StaticClass; return nullptr; }
template <class T> T* FindObject(UObject* Outer, const TCHAR* Name, bool ExactClass = false) { (void)&T::StaticClass; return nullptr; }
template <class T> T* FindObjectChecked(UObject* Outer, const TCHAR* Name, bool ExactClass = false) { (void)&T::StaticClass; return nullptr; }
template <class T> T* FindObjectFast(UObject* Outer, FName Name, bool ExactClass = false) { (void)&T::StaticClass; return nullptr; }
enum class EFindFirstObjectOptions { None = 0, ExactClass = 1, NativeFirst = 2, EnsureIfAmbiguous = 4 };
template <class T> T* FindFirstObject(const TCHAR* Name, EFindFirstObjectOptions Options = EFindFirstObjectOptions::None) { (void)&T::StaticClass; return nullptr; }
template <class T> const T* GetDefault() { (void)&T::StaticClass; return nullptr; }
template <class T> const T* GetDefault(UClass* Class) { (void)&T::StaticClass; return nullptr; }
template <class T> T* GetMutableDefault() { (void)&T::StaticClass; return nullptr; }
template <class T> T* GetMutableDefault(UClass* Class) { (void)&T::StaticClass; return nullptr; }
void GetObjectsOfClass(const UClass* ClassToLookFor, TArray<UObject*>& Results, bool bIncludeDerivedClasses = true, EObjectFlags ExcludeFlags = RF_ClassDefaultObject, EInternalObjectFlags ExclusionInternalFlags = EInternalObjectFlags::None);
void GetObjectsWithOuter(const UObject* Outer, TArray<UObject*>& Results, bool bIncludeNestedObjects = true, EObjectFlags ExclusionFlags = RF_NoFlags, EInternalObjectFlags ExclusionInternalFlags = EInternalObjectFlags::None);
FName MakeUniqueObjectName(UObject* Outer, const UClass* Class, FName BaseName = NAME_None);

template <class T>
class TObjectIterator
{
public:
    explicit TObjectIterator(EObjectFlags AdditionalExclusionFlags = RF_ClassDefaultObject, bool bIncludeDerivedClasses = true, EInternalObjectFlags InInternalExclusionFlags = EInternalObjectFlags::None) {}
    explicit operator bool() const { return ::UEStub::Fake<bool>(); }
    TObjectIterator& operator++() { return ::UEStub::Fake<TObjectIterator&>(); }
    T* operator*() const { return ::UEStub::Fake<T*>(); }
    T* operator->() const { return ::UEStub::Fake<T*>(); }
};
template <class T> class TObjectRange
{
public:
    TObjectRange(EObjectFlags AdditionalExclusionFlags = RF_ClassDefaultObject, bool bIncludeDerivedClasses = true, EInternalObjectFlags InInternalExclusionFlags = EInternalObjectFlags::None) {}
    struct FIter { T* operator*() const; FIter& operator++(); bool operator!=(const FIter&) const; };
    FIter begin() const { return ::UEStub::Fake<FIter>(); }
    FIter end() const { return ::UEStub::Fake<FIter>(); }
};

// ---------------------------------------------------------------- networking forward types
struct FLifetimeProperty;
enum ELifetimeCondition : int
{
    COND_None = 0,
    COND_InitialOnly = 1,
    COND_OwnerOnly = 2,
    COND_SkipOwner = 3,
    COND_SimulatedOnly = 4,
    COND_AutonomousOnly = 5,
    COND_SimulatedOrPhysics = 6,
    COND_InitialOrOwner = 7,
    COND_Custom = 8,
    COND_ReplayOrOwner = 9,
    COND_ReplayOnly = 10,
    COND_SimulatedOnlyNoReplay = 11,
    COND_SimulatedOrPhysicsNoReplay = 12,
    COND_SkipReplay = 13,
    COND_Dynamic = 14,
    COND_Never = 15,
    COND_NetGroup = 16,
    COND_Max = 17,
};
enum ELifetimeRepNotifyCondition { REPNOTIFY_OnChanged = 0, REPNOTIFY_Always = 1 };

// Frame / native function glue (used by generated code only)
struct FFrame { UObject* Object; UFunction* Node; };
#define P_FINISH
#define RESULT_PARAM Z_Param__Result
#define DECLARE_FUNCTION(func) static void func(UObject* Context, FFrame& Stack, void* const RESULT_PARAM)
#define DEFINE_FUNCTION(func) void func(UObject* Context, FFrame& Stack, void* const RESULT_PARAM)
