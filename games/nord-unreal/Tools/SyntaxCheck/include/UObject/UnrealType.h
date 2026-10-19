// Offline UE 5.x API stub: UObject/UnrealType.h (property reflection)
#pragma once
#include "UEStub/UObjectCore.h"
class FField
{
public:
    virtual ~FField();
    FName GetFName() const;
    FString GetName() const;
    FString GetNameCPP() const;
    FField* Next;
};
class FProperty : public FField
{
public:
    int32 ArrayDim;
    int32 ElementSize;
    int32 GetSize() const;
    int32 GetOffset_ForInternal() const;
    template <typename ValueType> ValueType* ContainerPtrToValuePtr(UObject* ContainerPtr, int32 ArrayIndex = 0) const;
    template <typename ValueType> ValueType* ContainerPtrToValuePtr(void* ContainerPtr, int32 ArrayIndex = 0) const;
    template <typename ValueType> const ValueType* ContainerPtrToValuePtr(UObject const* ContainerPtr, int32 ArrayIndex = 0) const;
    template <typename ValueType> const ValueType* ContainerPtrToValuePtr(void const* ContainerPtr, int32 ArrayIndex = 0) const;
    bool HasAnyPropertyFlags(uint64 FlagsToCheck) const;
    FString GetCPPType(FString* ExtendedTypeText = nullptr, uint32 CPPExportFlags = 0) const;
    bool Identical(const void* A, const void* B, uint32 PortFlags = 0) const;
    void CopyCompleteValue(void* Dest, void const* Src) const;
};
class FNumericProperty : public FProperty
{
public:
    bool IsFloatingPoint() const;
    bool IsInteger() const;
    bool IsEnum() const;
    UEnum* GetIntPropertyEnum() const;
    void SetIntPropertyValue(void* Data, uint64 Value) const;
    void SetIntPropertyValue(void* Data, int64 Value) const;
    void SetFloatingPointPropertyValue(void* Data, double Value) const;
    int64 GetSignedIntPropertyValue(void const* Data) const;
    uint64 GetUnsignedIntPropertyValue(void const* Data) const;
    double GetFloatingPointPropertyValue(void const* Data) const;
    FString GetNumericPropertyValueToString(void const* Data) const;
};
// typed accessors shared by every concrete property class (UObject/UnrealType.h)
template <typename InTCppType>
class TPropertyTypeFundamentals
{
public:
    typedef InTCppType TCppType;
    static TCppType const& GetPropertyValue(void const* A);
    static TCppType& GetPropertyValue(void* A);
    static TCppType const* GetPropertyValuePtr(void const* A);
    static TCppType* GetPropertyValuePtr(void* A);
    static void SetPropertyValue(void* A, TCppType const& Value);
    static TCppType GetDefaultPropertyValue();
};
template <typename InTCppType, class TInPropertyBaseClass>
class TProperty : public TInPropertyBaseClass, public TPropertyTypeFundamentals<InTCppType>
{
public:
    typedef InTCppType TCppType;
    TCppType GetPropertyValue_InContainer(void const* A, int32 ArrayIndex = 0) const;
    TCppType const* GetPropertyValuePtr_InContainer(void const* A, int32 ArrayIndex = 0) const;
    TCppType* GetPropertyValuePtr_InContainer(void* A, int32 ArrayIndex = 0) const;
    void SetPropertyValue_InContainer(void* A, TCppType const& Value, int32 ArrayIndex = 0) const;
    void GetValue_InContainer(void const* A, TCppType* OutValue) const;
    void SetValue_InContainer(void* A, const TCppType& Value) const;
};
template <typename InTCppType>
class TProperty_Numeric : public TProperty<InTCppType, FNumericProperty> {};
class FByteProperty : public TProperty_Numeric<uint8> { public: UEnum* Enum; };
class FInt8Property : public TProperty_Numeric<int8> {};
class FInt16Property : public TProperty_Numeric<int16> {};
class FIntProperty : public TProperty_Numeric<int32> {};
class FInt64Property : public TProperty_Numeric<int64> {};
class FUInt16Property : public TProperty_Numeric<uint16> {};
class FUInt32Property : public TProperty_Numeric<uint32> {};
class FUInt64Property : public TProperty_Numeric<uint64> {};
class FFloatProperty : public TProperty_Numeric<float> {};
class FDoubleProperty : public TProperty_Numeric<double> {};
class FBoolProperty : public FProperty
{
public:
    bool GetPropertyValue(void const* A) const;
    bool GetPropertyValue_InContainer(void const* A, int32 ArrayIndex = 0) const;
    void SetPropertyValue(void* A, bool Value) const;
    void SetPropertyValue_InContainer(void* A, bool Value, int32 ArrayIndex = 0) const;
    bool IsNativeBool() const;
};
class FObjectPropertyBase : public FProperty { public: UClass* PropertyClass; };
class FObjectProperty : public FObjectPropertyBase {};
class FClassProperty : public FObjectProperty {};
class FNameProperty : public TProperty<FName, FProperty> {};
class FStrProperty : public TProperty<FString, FProperty> {};
class FTextProperty : public TProperty<FText, FProperty> {};
class FStructProperty : public FProperty { public: UScriptStruct* Struct; };
class FArrayProperty : public FProperty { public: FProperty* Inner; };
class FMapProperty : public FProperty {};
class FSetProperty : public FProperty {};
class FEnumProperty : public FProperty { public: UEnum* GetEnum() const; };
template <typename FieldType> FieldType* FindFProperty(const UStruct* Owner, FName FieldName);
template <typename FieldType> FieldType* FindFProperty(const TCHAR* InFieldPath);
template <class T> class TFieldIterator
{
public:
    explicit TFieldIterator(const UStruct* InStruct, int32 InIterationFlags = 0);
    explicit operator bool() const;
    TFieldIterator& operator++();
    T* operator*() const;
    T* operator->() const;
};
