#pragma once

// English words for the side-job result plate. The native HUD and the play shell use the same lines.
// No Unreal includes. Place names stay names. The wanted plate and the job column are not this plate.

#include <string>

namespace QuebecBanner
{
    inline constexpr const char* Done = "MISSION DONE";
    inline constexpr const char* Failed = "MISSION FAILED";
    inline constexpr const char* KeyRetry = "R restarts";
    inline constexpr const char* TouchRetry = "Menu · Recover";

    inline constexpr const char* Abandoned = "Mission abandoned";
    inline constexpr const char* Arrested = "Arrested by the police";
    inline constexpr const char* KnockedOut = "Knocked out";
    inline constexpr const char* TimeUp = "Time ran out";
    inline constexpr const char* Crushed = "The order is crushed";
    inline constexpr const char* Delivered = "Three doors delivered, still hot";
    inline constexpr const char* ThiefGone = "The thief got away";
    inline constexpr const char* Wrecked = "The stolen car is wrecked";
    inline constexpr const char* Recovered = "You took the stolen car back";
    inline constexpr const char* LostThief = "The thief lost you";
    inline constexpr const char* NoGoons = "The crew never showed";
    inline constexpr const char* LeftTheatre = "You left the theatre";
    inline constexpr const char* TheatreSaved = "The Theatre de Verdure is saved";
    inline constexpr const char* Garaged = "Stashed at the garage";
    inline constexpr const char* PoliceLost = "Police lost";
    inline constexpr const char* PostersUp = "Three posters pasted";
    inline constexpr const char* FareLeft = "The passenger got out";
    inline constexpr const char* FareDone = "Passenger dropped off";

    inline constexpr const char* Wanted = "WANTED";
    inline constexpr const char* ArrestedWord = "ARRESTED";
    inline constexpr const char* KnockedWord = "KNOCKED OUT";
    inline constexpr const char* LostPolice = "LOST THEM";
    inline constexpr const char* LostDetail = "The police let go";
    inline constexpr const char* GarageWord = "GARAGE";
    inline constexpr const char* GarageDetail = "New plates. The search is off.";
    inline constexpr const char* StationLine = "To Poste de quartier 38";
    // The hospital keeps its name. The chrome word in front of it is English.
    inline constexpr const char* HospitalLine = "To H\xC3\xB4pital Notre-Dame";

    struct FPlate
    {
        const char* Head = Failed;
        std::string Line;
    };

    inline FPlate Compose(bool bDone, int Reward, const char* Result, bool bTouch, bool bRetry)
    {
        FPlate Out;
        Out.Head = bDone ? Done : Failed;
        const char* Body = Result ? Result : "";
        if (bDone)
            Out.Line = std::string("+") + std::to_string(Reward) + " $  ·  " + Body;
        else
        {
            Out.Line = Body;
            if (bRetry)
            {
                Out.Line += "  ·  ";
                Out.Line += bTouch ? TouchRetry : KeyRetry;
            }
        }
        return Out;
    }

    inline std::string StarLine(int Stars)
    {
        if (Stars < 0) Stars = 0;
        return std::to_string(Stars) + (Stars == 1 ? " star" : " stars");
    }

    // Result lines are plain ASCII. The middle dot lives only in the composed separator and the touch retry.
    inline bool PlainEnglish(const char* Text)
    {
        if (!Text) return false;
        for (const unsigned char* Glyph = reinterpret_cast<const unsigned char*>(Text); *Glyph; ++Glyph)
            if (*Glyph > 127) return false;
        return true;
    }
}
