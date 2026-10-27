#pragma once

// Engine-independent rules for the campaign slot.
// No Unreal includes, so Scripts/test_story_save.py can build this with the system compiler.
// Version 1 is the race boundary (completed missions 0–2) and has no story tail.
// Version 2 is the unsupported fixture the story slice plants on disk. It is never written.
// Version 3 keeps that same mission count and the eight story steps. It starts the escort, the crossing, the grab, and the short way over.
// Version 4 adds the escort step and starts the crossing, the grab, and the short way over.
// Version 5 adds the crossing and starts the grab and the short way over.
// Version 6 adds the grab and starts the short way over.
// Version 7 adds the short way and starts the chase over.
// Version 8 adds the chase and starts the finale over.
// Version 9 adds the finale and starts the follow over.
// Version 10 adds the follow step and starts the cart over.
// Version 11 adds the cart step and starts the bells over.
// Version 12 adds which bell is next and starts the block over.
// Version 13 adds the block step and starts the send-off over.
// Version 14 adds the send-off stage and starts the pursuit over.
// Version 15 adds the pursuit step and starts the stall over.
// Version 16 adds the stall step and starts the slip over.
// Version 17 adds the slip step and starts the march over.
// Version 18 adds the march step and starts the ditch over.
// Version 19 adds the ditch step and starts the parcel over.
// Version 20 adds the parcel step and starts the bolt over.
// Version 21 adds the bolt step and starts the yard over. Version 22 adds the yard step and starts the lift over. Version 23 adds the lift step and starts the post over. Version 24 adds the post step.
// The chain, the hold clocks, the court misses, cash, the friend's place on the lawn,
// the lamp burn, the grab clock, the rival's clock, the tail's place on the road,
// the finale burn, the page clock, the cut clock, the finale tail's place, the follow
// person's place on the path, how far the cart has rolled, how far the courier has driven,
// how far the send-off drive got, how far the traffic car has driven, the pursuer's place
// on the slip, where the march has walked, how far the chase car has driven, where the
// two street cars are, the parcel clock, where the seeker is, the bolt clock, where the
// watcher is looking, whether the crossing is armed, where they are on the walk, how long they have stood, and the side errands are not in this record.

namespace QuebecStorySave
{
    inline constexpr int Legacy = 1;
    inline constexpr int Rejected = 2;
    inline constexpr int Story = 3;
    inline constexpr int Escort = 4;
    inline constexpr int Shade = 5;
    inline constexpr int Grab = 6;
    inline constexpr int Cut = 7;
    inline constexpr int Chase = 8;
    inline constexpr int Finale = 9;
    inline constexpr int Follow = 10;
    inline constexpr int Roll = 11;
    inline constexpr int Bell = 12;
    inline constexpr int Block = 13;
    inline constexpr int Send = 14;
    inline constexpr int Pursue = 15;
    inline constexpr int Nose = 16;
    inline constexpr int Slip = 17;
    inline constexpr int March = 18;
    inline constexpr int Ditch = 19;
    inline constexpr int Parcel = 20;
    inline constexpr int Bolt = 21;
    inline constexpr int Yard = 22;
    inline constexpr int Lift = 23;
    inline constexpr int Current = 24;

    inline constexpr int PondBanked = 6;
    inline constexpr int CourtBanked = 4;
    inline constexpr int ShowBanked = 5;
    inline constexpr int RescueDone = 7;
    inline constexpr int ConvoyBanked = 4;
    inline constexpr int BlankBanked = 4;
    inline constexpr int TourBanked = 3;
    inline constexpr int HomeBanked = 3;
    inline constexpr int EscortBanked = 2;
    inline constexpr int ShadeBanked = 2;
    inline constexpr int GrabBanked = 2;
    inline constexpr int CutBanked = 2;
    inline constexpr int ChaseBanked = 2;
    inline constexpr int FinaleBanked = 5;
    inline constexpr int FollowBanked = 2;
    inline constexpr int RollBanked = 2;
    inline constexpr int BellBanked = 3;
    inline constexpr int BlockBanked = 2;
    inline constexpr int SendBanked = 4;
    inline constexpr int PursueBanked = 1;
    inline constexpr int NoseBanked = 1;
    inline constexpr int SlipBanked = 2;
    inline constexpr int MarchBanked = 3;
    inline constexpr int DitchBanked = 3;
    inline constexpr int ParcelBanked = 2;
    inline constexpr int BoltBanked = 3;
    inline constexpr int YardBanked = 1;
    inline constexpr int LiftBanked = 1;
    inline constexpr int PostBanked = 1;

    struct FSteps
    {
        int Pond = 0;
        int Court = 0;
        int Show = 0;
        int Rescue = 0;
        int Convoy = 0;
        int Blank = 0;
        int Tour = 0;
        int Home = 0;
        int Escort = 0;
        int Shade = 0;
        int Grab = 0;
        int Cut = 0;
        int Chase = 0;
        int Finale = 0;
        int Follow = 0;
        int Roll = 0;
        int Bell = 0;
        int Block = 0;
        int Send = 0;
        int Pursue = 0;
        int Nose = 0;
        int Slip = 0;
        int March = 0;
        int Ditch = 0;
        int Parcel = 0;
        int Bolt = 0;
        int Yard = 0;
        int Lift = 0;
        int Post = 0;
    };

    inline bool InRange(int Value, int Hi)
    {
        return Value >= 0 && Value <= Hi;
    }

    inline bool Fresh(const FSteps& Steps)
    {
        return Steps.Pond == 0 && Steps.Court == 0 && Steps.Show == 0 && Steps.Rescue == 0
            && Steps.Convoy == 0 && Steps.Blank == 0 && Steps.Tour == 0 && Steps.Home == 0
            && Steps.Escort == 0 && Steps.Shade == 0 && Steps.Grab == 0 && Steps.Cut == 0
            && Steps.Chase == 0 && Steps.Finale == 0 && Steps.Follow == 0 && Steps.Roll == 0
            && Steps.Bell == 0 && Steps.Block == 0 && Steps.Send == 0 && Steps.Pursue == 0
            && Steps.Nose == 0 && Steps.Slip == 0 && Steps.March == 0 && Steps.Ditch == 0 && Steps.Parcel == 0 && Steps.Bolt == 0 && Steps.Yard == 0 && Steps.Lift == 0 && Steps.Post == 0;
    }

    // A later beat may move only after the one before it is banked.
    inline bool StepsFit(const FSteps& Steps)
    {
        if (!InRange(Steps.Pond, PondBanked) || !InRange(Steps.Court, CourtBanked)
            || !InRange(Steps.Show, ShowBanked) || !InRange(Steps.Rescue, RescueDone)
            || !InRange(Steps.Convoy, ConvoyBanked) || !InRange(Steps.Blank, BlankBanked)
            || !InRange(Steps.Tour, TourBanked) || !InRange(Steps.Home, HomeBanked)
            || !InRange(Steps.Escort, EscortBanked)
            || !InRange(Steps.Shade, ShadeBanked)
            || !InRange(Steps.Grab, GrabBanked)
            || !InRange(Steps.Cut, CutBanked)
            || !InRange(Steps.Chase, ChaseBanked)
            || !InRange(Steps.Finale, FinaleBanked)
            || !InRange(Steps.Follow, FollowBanked)
            || !InRange(Steps.Roll, RollBanked)
            || !InRange(Steps.Bell, BellBanked)
            || !InRange(Steps.Block, BlockBanked)
            || !InRange(Steps.Send, SendBanked)
            || !InRange(Steps.Pursue, PursueBanked)
            || !InRange(Steps.Nose, NoseBanked)
            || !InRange(Steps.Slip, SlipBanked)
            || !InRange(Steps.March, MarchBanked)
            || !InRange(Steps.Ditch, DitchBanked)
            || !InRange(Steps.Parcel, ParcelBanked)
            || !InRange(Steps.Bolt, BoltBanked)
            || !InRange(Steps.Yard, YardBanked)
            || !InRange(Steps.Lift, LiftBanked)
            || !InRange(Steps.Post, PostBanked))
            return false;
        if (Steps.Court > 0 && Steps.Pond != PondBanked) return false;
        if (Steps.Show > 0 && (Steps.Pond != PondBanked || Steps.Court != CourtBanked)) return false;
        if (Steps.Rescue > 0 && (Steps.Pond != PondBanked || Steps.Court != CourtBanked || Steps.Show != ShowBanked))
            return false;
        if (Steps.Convoy > 0 && (Steps.Show != ShowBanked || Steps.Rescue != RescueDone)) return false;
        if (Steps.Blank > 0 && (Steps.Rescue != RescueDone || Steps.Convoy != ConvoyBanked)) return false;
        if (Steps.Tour > 0 && (Steps.Convoy != ConvoyBanked || Steps.Blank != BlankBanked)) return false;
        if (Steps.Home > 0 && (Steps.Blank != BlankBanked || Steps.Tour != TourBanked)) return false;
        if (Steps.Escort > 0 && Steps.Home != HomeBanked) return false;
        if (Steps.Shade > 0 && Steps.Escort != EscortBanked) return false;
        if (Steps.Grab > 0 && Steps.Shade != ShadeBanked) return false;
        if (Steps.Cut > 0 && Steps.Grab != GrabBanked) return false;
        if (Steps.Chase > 0 && Steps.Cut != CutBanked) return false;
        if (Steps.Finale > 0 && Steps.Chase != ChaseBanked) return false;
        if (Steps.Follow > 0 && Steps.Finale != FinaleBanked) return false;
        if (Steps.Roll > 0 && Steps.Follow != FollowBanked) return false;
        if (Steps.Bell > 0 && Steps.Roll != RollBanked) return false;
        if (Steps.Block > 0 && Steps.Bell != BellBanked) return false;
        if (Steps.Send > 0 && Steps.Block != BlockBanked) return false;
        if (Steps.Pursue > 0 && Steps.Send != SendBanked) return false;
        if (Steps.Nose > 0 && Steps.Pursue != PursueBanked) return false;
        if (Steps.Slip > 0 && Steps.Nose != NoseBanked) return false;
        if (Steps.March > 0 && Steps.Slip != SlipBanked) return false;
        if (Steps.Ditch > 0 && Steps.March != MarchBanked) return false;
        if (Steps.Parcel > 0 && Steps.Ditch != DitchBanked) return false;
        if (Steps.Bolt > 0 && Steps.Parcel != ParcelBanked) return false;
        if (Steps.Yard > 0 && Steps.Bolt != BoltBanked) return false;
        if (Steps.Lift > 0 && Steps.Yard != YardBanked) return false;
        if (Steps.Post > 0 && Steps.Lift != LiftBanked) return false;
        return true;
    }

    inline bool Accept(int Version, int Completed, const FSteps& Steps)
    {
        if (Completed < 0 || Completed > 2) return false;
        if (Version == Legacy) return Fresh(Steps);
        if (Version == Story)
        {
            if (Steps.Escort != 0 || Steps.Shade != 0 || Steps.Grab != 0 || Steps.Cut != 0 || Steps.Chase != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Escort)
        {
            if (Steps.Shade != 0 || Steps.Grab != 0 || Steps.Cut != 0 || Steps.Chase != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Shade)
        {
            if (Steps.Grab != 0 || Steps.Cut != 0 || Steps.Chase != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Grab)
        {
            if (Steps.Cut != 0 || Steps.Chase != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Cut)
        {
            if (Steps.Chase != 0 || Steps.Finale != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Chase)
        {
            if (Steps.Finale != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Finale)
        {
            if (Steps.Follow != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Follow)
        {
            if (Steps.Roll != 0 || Steps.Bell != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Roll)
        {
            if (Steps.Bell != 0 || Steps.Block != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Bell)
        {
            if (Steps.Block != 0 || Steps.Send != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Block)
        {
            if (Steps.Send != 0 || Steps.Pursue != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Send)
        {
            if (Steps.Pursue != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Pursue)
        {
            if (Steps.Nose != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Nose)
        {
            if (Steps.Slip != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Slip)
        {
            if (Steps.March != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == March)
        {
            if (Steps.Ditch != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Ditch)
        {
            if (Steps.Parcel != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Parcel)
        {
            if (Steps.Bolt != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Bolt)
        {
            if (Steps.Yard != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Yard)
        {
            if (Steps.Lift != 0) return false;
            if (Steps.Post != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version == Lift)
        {
            if (Steps.Post != 0) return false;
            if (Completed < 2 && !Fresh(Steps)) return false;
            return StepsFit(Steps);
        }
        if (Version != Current) return false;
        if (Completed < 2 && !Fresh(Steps)) return false;
        return StepsFit(Steps);
    }

    // A legacy slot never copies a story tail. A version-3 slot never copies the escort, the crossing, the grab, or the short way.
    // A version-4 slot never copies the crossing, the grab, or the short way. A version-5 slot never copies the grab or the short way.
    // A version-6 slot never copies the short way. A version-7 slot never copies the chase.
    // A version-8 slot never copies the finale. A version-9 slot never copies the follow.
    // A version-10 slot never copies the cart. A version-11 slot never copies the bells.
    // A version-12 slot never copies the block. A version-13 slot never copies the send-off.
    // A version-14 slot never copies the pursuit. A version-15 slot never copies the stall.
    // A version-16 slot never copies the slip. A version-17 slot never copies the march. A version-18 slot never copies the ditch. A version-19 slot never copies the parcel. A version-20 slot never copies the bolt. A version-21 slot never copies the yard. A version-22 slot never copies the lift. A version-23 slot never copies the post. Call this only after Accept.
    inline FSteps Applied(int Version, const FSteps& Steps)
    {
        if (Version == Legacy) return {};
        if (Version == Story)
        {
            FSteps Copy = Steps;
            Copy.Escort = 0;
            Copy.Shade = 0;
            Copy.Grab = 0;
            Copy.Cut = 0;
            Copy.Chase = 0;
            Copy.Finale = 0;
            Copy.Follow = 0;
            Copy.Roll = 0;
            Copy.Bell = 0;
            Copy.Block = 0;
            Copy.Send = 0;
            Copy.Pursue = 0;
            Copy.Nose = 0;
            Copy.Slip = 0;
            Copy.March = 0;
            Copy.Ditch = 0;
            Copy.Parcel = 0;
            Copy.Bolt = 0;
            Copy.Yard = 0;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == Escort)
        {
            FSteps Copy = Steps;
            Copy.Shade = 0;
            Copy.Grab = 0;
            Copy.Cut = 0;
            Copy.Chase = 0;
            Copy.Finale = 0;
            Copy.Follow = 0;
            Copy.Roll = 0;
            Copy.Bell = 0;
            Copy.Block = 0;
            Copy.Send = 0;
            Copy.Pursue = 0;
            Copy.Nose = 0;
            Copy.Slip = 0;
            Copy.March = 0;
            Copy.Ditch = 0;
            Copy.Parcel = 0;
            Copy.Bolt = 0;
            Copy.Yard = 0;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == Shade)
        {
            FSteps Copy = Steps;
            Copy.Grab = 0;
            Copy.Cut = 0;
            Copy.Chase = 0;
            Copy.Finale = 0;
            Copy.Follow = 0;
            Copy.Roll = 0;
            Copy.Bell = 0;
            Copy.Block = 0;
            Copy.Send = 0;
            Copy.Pursue = 0;
            Copy.Nose = 0;
            Copy.Slip = 0;
            Copy.March = 0;
            Copy.Ditch = 0;
            Copy.Parcel = 0;
            Copy.Bolt = 0;
            Copy.Yard = 0;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == Grab)
        {
            FSteps Copy = Steps;
            Copy.Cut = 0;
            Copy.Chase = 0;
            Copy.Finale = 0;
            Copy.Follow = 0;
            Copy.Roll = 0;
            Copy.Bell = 0;
            Copy.Block = 0;
            Copy.Send = 0;
            Copy.Pursue = 0;
            Copy.Nose = 0;
            Copy.Slip = 0;
            Copy.March = 0;
            Copy.Ditch = 0;
            Copy.Parcel = 0;
            Copy.Bolt = 0;
            Copy.Yard = 0;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == Cut)
        {
            FSteps Copy = Steps;
            Copy.Chase = 0;
            Copy.Finale = 0;
            Copy.Follow = 0;
            Copy.Roll = 0;
            Copy.Bell = 0;
            Copy.Block = 0;
            Copy.Send = 0;
            Copy.Pursue = 0;
            Copy.Nose = 0;
            Copy.Slip = 0;
            Copy.March = 0;
            Copy.Ditch = 0;
            Copy.Parcel = 0;
            Copy.Bolt = 0;
            Copy.Yard = 0;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == Chase)
        {
            FSteps Copy = Steps;
            Copy.Finale = 0;
            Copy.Follow = 0;
            Copy.Roll = 0;
            Copy.Bell = 0;
            Copy.Block = 0;
            Copy.Send = 0;
            Copy.Pursue = 0;
            Copy.Nose = 0;
            Copy.Slip = 0;
            Copy.March = 0;
            Copy.Ditch = 0;
            Copy.Parcel = 0;
            Copy.Bolt = 0;
            Copy.Yard = 0;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == Finale)
        {
            FSteps Copy = Steps;
            Copy.Follow = 0;
            Copy.Roll = 0;
            Copy.Bell = 0;
            Copy.Block = 0;
            Copy.Send = 0;
            Copy.Pursue = 0;
            Copy.Nose = 0;
            Copy.Slip = 0;
            Copy.March = 0;
            Copy.Ditch = 0;
            Copy.Parcel = 0;
            Copy.Bolt = 0;
            Copy.Yard = 0;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == Follow)
        {
            FSteps Copy = Steps;
            Copy.Roll = 0;
            Copy.Bell = 0;
            Copy.Block = 0;
            Copy.Send = 0;
            Copy.Pursue = 0;
            Copy.Nose = 0;
            Copy.Slip = 0;
            Copy.March = 0;
            Copy.Ditch = 0;
            Copy.Parcel = 0;
            Copy.Bolt = 0;
            Copy.Yard = 0;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == Roll)
        {
            FSteps Copy = Steps;
            Copy.Bell = 0;
            Copy.Block = 0;
            Copy.Send = 0;
            Copy.Pursue = 0;
            Copy.Nose = 0;
            Copy.Slip = 0;
            Copy.March = 0;
            Copy.Ditch = 0;
            Copy.Parcel = 0;
            Copy.Bolt = 0;
            Copy.Yard = 0;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == Bell)
        {
            FSteps Copy = Steps;
            Copy.Block = 0;
            Copy.Send = 0;
            Copy.Pursue = 0;
            Copy.Nose = 0;
            Copy.Slip = 0;
            Copy.March = 0;
            Copy.Ditch = 0;
            Copy.Parcel = 0;
            Copy.Bolt = 0;
            Copy.Yard = 0;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == Block)
        {
            FSteps Copy = Steps;
            Copy.Send = 0;
            Copy.Pursue = 0;
            Copy.Nose = 0;
            Copy.Slip = 0;
            Copy.March = 0;
            Copy.Ditch = 0;
            Copy.Parcel = 0;
            Copy.Bolt = 0;
            Copy.Yard = 0;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == Send)
        {
            FSteps Copy = Steps;
            Copy.Pursue = 0;
            Copy.Nose = 0;
            Copy.Slip = 0;
            Copy.March = 0;
            Copy.Ditch = 0;
            Copy.Parcel = 0;
            Copy.Bolt = 0;
            Copy.Yard = 0;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == Pursue)
        {
            FSteps Copy = Steps;
            Copy.Nose = 0;
            Copy.Slip = 0;
            Copy.March = 0;
            Copy.Ditch = 0;
            Copy.Parcel = 0;
            Copy.Bolt = 0;
            Copy.Yard = 0;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == Nose)
        {
            FSteps Copy = Steps;
            Copy.Slip = 0;
            Copy.March = 0;
            Copy.Ditch = 0;
            Copy.Parcel = 0;
            Copy.Bolt = 0;
            Copy.Yard = 0;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == Slip)
        {
            FSteps Copy = Steps;
            Copy.March = 0;
            Copy.Ditch = 0;
            Copy.Parcel = 0;
            Copy.Bolt = 0;
            Copy.Yard = 0;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == March)
        {
            FSteps Copy = Steps;
            Copy.Ditch = 0;
            Copy.Parcel = 0;
            Copy.Bolt = 0;
            Copy.Yard = 0;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == Ditch)
        {
            FSteps Copy = Steps;
            Copy.Parcel = 0;
            Copy.Bolt = 0;
            Copy.Yard = 0;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == Parcel)
        {
            FSteps Copy = Steps;
            Copy.Bolt = 0;
            Copy.Yard = 0;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == Bolt)
        {
            FSteps Copy = Steps;
            Copy.Yard = 0;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == Yard)
        {
            FSteps Copy = Steps;
            Copy.Lift = 0;
            Copy.Post = 0;
            return Copy;
        }
        if (Version == Lift)
        {
            FSteps Copy = Steps;
            Copy.Post = 0;
            return Copy;
        }
        return Steps;
    }
}
