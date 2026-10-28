#pragma once

// Two places a Montréal session can start. No Unreal types.
//
// Sherbrooke is the opening sidewalk. Rachel is the sidewalk in front of a
// surveyed building on Rue Rachel Est, about 780 m away on the same road
// graph. The stand sits past the curb and short of the wall. The look aims
// down that street: a point further along the lane, the same lead Joseph V.
// Mascelli describes in The Five C's of Cinematography (1965). An unknown
// name stays on Sherbrooke, so a bad flag does not move the opening.

#include <cmath>
#include <cstring>

namespace QuebecPlace
{
    inline constexpr int Count = 2;

    struct FPlace
    {
        const char* Name = "";
        double X = 0.;
        double Y = 0.;
        double Z = 120.;
        float Yaw = 0.f;
        bool bOwnYaw = false;
    };

    // Place 0 matches LaFontaine::Spawn. Place 1 is 490 cm off the centre of
    // road segment 389 (Rue Rachel Est, 620 cm wide), toward the building.
    inline constexpr FPlace Places[Count] = {
        {"Sherbrooke", 38793.017, -7522.815, 120.0, 0.f, false},
        {"Rachel", -38444.7037, 3733.9049, 120.0, -138.3187f, true},
    };

    inline FPlace PlaceAt(int Index)
    {
        if (Index < 0 || Index >= Count) Index = 0;
        return Places[Index];
    }

    inline int IndexFor(const char* Text)
    {
        if (!Text || !Text[0]) return 0;
        char Buffer[32];
        int CountChars = 0;
        for (; Text[CountChars] && CountChars < 31; ++CountChars)
        {
            char Letter = Text[CountChars];
            if (Letter >= 'A' && Letter <= 'Z') Letter = static_cast<char>(Letter - 'A' + 'a');
            Buffer[CountChars] = Letter;
        }
        Buffer[CountChars] = 0;
        if (std::strcmp(Buffer, "1") == 0 || std::strcmp(Buffer, "rachel") == 0) return 1;
        return 0;
    }

    inline double Separation()
    {
        return std::hypot(Places[1].X - Places[0].X, Places[1].Y - Places[0].Y);
    }
}
