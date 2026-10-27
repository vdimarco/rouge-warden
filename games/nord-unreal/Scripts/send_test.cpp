#ifdef QUEBEC_SEND_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecSend.h"
#include "../Source/Quebec/QuebecBells.h"
#include "../Source/Quebec/QuebecFinale.h"
#include "../Source/Quebec/QuebecStorySave.h"

#include <cmath>
#include <cstdio>

namespace
{
    int Assertions = 0;
    int Failures = 0;

    void Expect(bool Condition, const char* What)
    {
        ++Assertions;
        if (!Condition)
        {
            ++Failures;
            std::fprintf(stderr, "FAIL %s\n", What);
        }
    }
}

int main()
{
    using namespace QuebecSend;
    Expect(StepBanked == 4 && Pay == 520, "the send-off left its purse");
    Expect(CountsAsCar(0) && !CountsAsCar(1) && !CountsAsCar(2) && !CountsAsCar(3), "a bike counted as the send-off car");
    Expect(DoorY - GateY == DriveSpan && SpeedCap == 1600. && Crawl < 450., "the drive left its cap");
    Expect(FootReach * 2. < DoorY - GateY && CarReach * 2. < GateY - BayY, "two stages share a circle");
    Expect(std::fabs(ColumnX - QuebecBells::BellX) > 2500. && std::fabs(ColumnX - QuebecFinale::ColumnX) > 2500., "the send-off sat on an earlier column");
    const FSpot Back = Recover(StepDoor);
    Expect(!InDoor(Back.X, Back.Y), "recover stands in the door");
    const FSpot Last = Recover(StepWalk);
    Expect(!InFinish(Last.X, Last.Y), "recover stands in the finish");
    Expect(Offers(true, StepDoor) && Offers(true, StepWalk) && !Offers(true, StepBanked) && !Offers(false, StepDoor), "the send-off opened early");

    FDay Now;
    const FDay CarDoor = Tick(Now, Slice, false, true, true, 0., true, true);
    Expect(CarDoor.Step == StepDoor, "a car opened the door");
    const FDay Door = Tick(Now, Slice, true, false, true, 0., true, false);
    Expect(Door.Step == StepDrive && Door.Driven == 0. && Purse(StepDoor, Door.Step) == 0, "the door did not start the drive");

    FDay Gentle = Door;
    for (int TickIndex = 0; TickIndex < 17; ++TickIndex)
        Gentle = Tick(Gentle, Slice, false, true, true, 1000., false, true);
    Expect(Gentle.Step == StepDrive && std::fabs(Gentle.Driven - 1000. * Slice * 17.) < 1., "a gentle drive did not add up");
    const FDay LongFrame = Tick(Door, 5., false, true, true, 1000., false, true);
    Expect(std::fabs(LongFrame.Driven - 1000. * Slice) < 1., "one long frame drove the whole lawn");
    const FDay Empty = Tick(Gentle, Slice, false, false, false, 1000., true, true);
    Expect(std::fabs(Empty.Driven - Gentle.Driven) < 1. && Empty.Step == StepDrive, "an empty lawn drove the car");
    const FDay OffLane = Tick(Door, Slice, false, true, true, 1000., false, false);
    Expect(OffLane.Driven == 0. && OffLane.Step == StepDrive, "a detour counted as the drive");

    FDay Hot = Gentle;
    const FDay Fast = Tick(Hot, Slice, false, true, true, 2000., true, true);
    Expect(Fast.bFast && Fast.Driven == 0. && Fast.Step == StepDrive && Purse(StepDrive, Fast.Step) == 0, "a flat-out run kept the drive");
    const FDay IdleFast = Tick(Door, Slice, false, true, true, 2000., true, true);
    Expect(!IdleFast.bFast && IdleFast.Driven == 0., "a sprint from nothing claimed a loss");

    const FDay Gate = Tick(Gentle, Slice, false, true, true, 1000., true, true);
    Expect(Gate.Step == StepStop && Purse(StepDrive, Gate.Step) == 0, "the gate did not open the bay");
    const FDay Rolling = Tick(Gate, Slice, false, true, true, 400., true, true);
    Expect(Rolling.Step == StepStop, "a rolling car counted as a stop");
    const FDay WalkerBay = Tick(Gate, Slice, true, false, true, 0., true, false);
    Expect(WalkerBay.Step == StepStop, "a walker parked the car");
    const FDay Held = Tick(Gate, Slice, false, true, true, 0., true, true);
    Expect(Held.Step == StepWalk, "a stopped car did not open the walk");
    const FDay StillCar = Tick(Held, Slice, false, true, true, 0., true, true);
    Expect(StillCar.Step == StepWalk, "the car walked the last stretch");
    const FDay Home = Tick(Held, Slice, true, false, true, 0., true, false);
    Expect(Home.Step == StepBanked && Purse(StepWalk, Home.Step) == Pay, "the walk did not bring the day home");
    const FDay Twice = Tick(Home, Slice, true, false, true, 0., true, false);
    Expect(Twice.Step == StepBanked && Purse(StepBanked, Twice.Step) == 0, "the send-off paid twice");

    QuebecStorySave::FSteps Saved;
    Saved.Pond = QuebecStorySave::PondBanked;
    Saved.Court = QuebecStorySave::CourtBanked;
    Saved.Show = QuebecStorySave::ShowBanked;
    Saved.Rescue = QuebecStorySave::RescueDone;
    Saved.Convoy = QuebecStorySave::ConvoyBanked;
    Saved.Blank = QuebecStorySave::BlankBanked;
    Saved.Tour = QuebecStorySave::TourBanked;
    Saved.Home = QuebecStorySave::HomeBanked;
    Saved.Escort = QuebecStorySave::EscortBanked;
    Saved.Shade = QuebecStorySave::ShadeBanked;
    Saved.Grab = QuebecStorySave::GrabBanked;
    Saved.Cut = QuebecStorySave::CutBanked;
    Saved.Chase = QuebecStorySave::ChaseBanked;
    Saved.Finale = QuebecStorySave::FinaleBanked;
    Saved.Follow = QuebecStorySave::FollowBanked;
    Saved.Roll = QuebecStorySave::RollBanked;
    Saved.Bell = QuebecStorySave::BellBanked;
    Saved.Block = QuebecStorySave::BlockBanked;
    Saved.Send = 1;
    Expect(QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a send-off in progress was rejected");
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Block, 2, Saved), "a version-13 slot carried the send-off");
    const QuebecStorySave::FSteps FromBlock = QuebecStorySave::Applied(QuebecStorySave::Block, Saved);
    Expect(FromBlock.Block == QuebecStorySave::BlockBanked && FromBlock.Send == 0, "a version-13 slot copied the send-off");
    Saved.Send = StepBanked + 1;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "a send-off past the bank was accepted");
    Saved.Send = 1;
    Saved.Block = 0;
    Expect(!QuebecStorySave::Accept(QuebecStorySave::Current, 2, Saved), "the send-off started before the block was banked");
    Expect(QuebecStorySave::Block == 13 && QuebecStorySave::Send == 14 && QuebecStorySave::Pursue == 15 && QuebecStorySave::Nose == 16 && QuebecStorySave::Slip == 17 && QuebecStorySave::March == 18 && QuebecStorySave::Ditch == 19 && QuebecStorySave::Parcel == 20 && QuebecStorySave::Bolt == 21 && QuebecStorySave::Yard == 22 && QuebecStorySave::Current == 23 && QuebecStorySave::Bell == 12, "the slot writer left version 23");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
