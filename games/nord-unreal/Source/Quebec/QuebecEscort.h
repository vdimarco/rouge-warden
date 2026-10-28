#pragma once

// Engine-independent rules for mission 11, walking Grey Coat to the east door.
// No Unreal includes, so Scripts/test_escort.py can build this with the system compiler.
// Grey Coat follows a person on foot and plants if that person rides off or gets too far.
// The beat is stored on the version-4 tail. A version-3 slot starts it over.
// The seven story banks stay seven. This beat pays a flat purse and does not take a chain link.

#include <cmath>

namespace QuebecEscort
{
    inline constexpr int StepMeet = 0;
    inline constexpr int StepWalk = 1;
    inline constexpr int StepBanked = 2;

    // East lawn, dry, far from a mapped road centre. The door is 56 m due south.
    inline constexpr double MeetX = 29600.;
    inline constexpr double MeetY = 16800.;
    inline constexpr double DoorX = 29600.;
    inline constexpr double DoorY = 11200.;
    inline constexpr double RecoverSouth = 900.;

    inline constexpr double Reach = 450.;
    // Catch a walker. A sprint is 800 and a walk is 450, so 560 closes on a walk and loses a sprint.
    inline constexpr double Speed = 560.;
    inline constexpr double Close = 180.;
    inline constexpr double Follow = 1400.;
    inline constexpr double Stop = 2200.;
    inline constexpr double Hitch = 0.1;
    inline constexpr int Pay = 480;

    struct FFriend
    {
        double X = MeetX;
        double Y = MeetY;
        bool bPlanted = false;
    };

    inline double Gap(double AX, double AY, double BX, double BY)
    {
        return std::hypot(AX - BX, AY - BY);
    }

    inline int Meet(int Step, bool bWalking, bool bAtMeet)
    {
        if (Step == StepMeet && bWalking && bAtMeet) return StepWalk;
        return Step;
    }

    // A hitch is capped, so one long frame cannot drag Grey Coat across the lawn.
    inline FFriend Move(FFriend Friend, double PlayerX, double PlayerY, double Seconds, bool bOnFoot)
    {
        if (Seconds < 0.) Seconds = 0.;
        if (Seconds > Hitch) Seconds = Hitch;
        const double Dist = Gap(Friend.X, Friend.Y, PlayerX, PlayerY);
        if (Friend.bPlanted)
        {
            if (bOnFoot && Dist <= Follow) Friend.bPlanted = false;
            else return Friend;
        }
        else if (!bOnFoot || Dist > Stop)
        {
            Friend.bPlanted = true;
            return Friend;
        }
        if (Dist <= Close || Dist <= 0.) return Friend;
        const double Room = Dist - Close;
        const double Step = Speed * Seconds;
        const double MoveBy = Step < Room ? Step : Room;
        Friend.X += (PlayerX - Friend.X) / Dist * MoveBy;
        Friend.Y += (PlayerY - Friend.Y) / Dist * MoveBy;
        return Friend;
    }

    inline bool Arrived(int Step, bool bOnFoot, bool bPlanted, double PlayerX, double PlayerY, double FriendX, double FriendY)
    {
        if (Step != StepWalk || !bOnFoot || bPlanted) return false;
        return Gap(PlayerX, PlayerY, DoorX, DoorY) <= Reach && Gap(FriendX, FriendY, DoorX, DoorY) <= Reach;
    }

    inline int Purse(int Before, int After)
    {
        return Before == StepWalk && After == StepBanked ? Pay : 0;
    }

    inline bool Offers(bool bHomeBanked, int Step)
    {
        return bHomeBanked && Step >= StepMeet && Step < StepBanked;
    }
}
