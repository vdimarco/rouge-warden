#pragma once
#include "UEStub/UObjectCore.h"
namespace ERootMotionMode { enum Type : int { NoRootMotionExtraction, IgnoreRootMotion, RootMotionFromEverything, RootMotionFromMontagesOnly }; }
namespace ERootMotionRootLock { enum Type : int { RefPose, AnimFirstFrame, Zero }; }
enum class EAnimInterpolationType : uint8 { Linear, Step };
enum class EAnimAlphaInputType : uint8 { Float, Bool, Curve };
enum class EAlphaBlendOption : uint8 { Linear, Cubic, HermiteCubic, Sinusoidal, QuadraticInOut, CubicInOut, QuarticInOut, QuinticInOut, CircularIn, CircularOut, CircularInOut, ExpIn, ExpOut, ExpInOut, Custom };
enum class EMontagePlayReturnType : uint8 { MontageLength, Duration };
enum EFilterInterpolationType : int { BSIT_Average, BSIT_Linear, BSIT_Cubic, BSIT_EaseInOut, BSIT_ExponentialDecay, BSIT_SpringDamper, BSIT_MAX };
