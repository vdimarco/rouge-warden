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

    inline constexpr const char* JobTitles[] = {
        "Hot delivery", "Car thief", "Ink overrun", "Five stars", "Three posters", "The fare"
    };
    inline constexpr int JobTitleCount = 6;
    inline constexpr const char* JobOn = "JOB ON";
    inline constexpr const char* JobAgain = "again";

    inline constexpr const char* Signs[] = {
        "HOT DELIVERY", "CAR THIEF", "INK OVERRUN", "FIVE STARS", "THREE POSTERS", "THE FARE"
    };
    inline constexpr const char* Briefs[] = {
        "Pick up the order at the cafe, then three doors. Hurry, it is hot.",
        "A thief is running on Sherbrooke. Ram the car until it gives.",
        "The Curator's crew is in the Theatre de Verdure. Three waves.",
        "Three stars on you. Lose the police or hide at the garage.",
        "Rue Gauthier, three corners. Paste them in any order. The clock does not grow.",
        "A passenger is waiting. Stay in the car to the quay. Four seconds on foot, and they get out."
    };
    inline constexpr const char* ThiefSign = "THIEF";
    inline constexpr const char* TakeOrder = "Pick up the order at the cafe";
    inline constexpr const char* ThiefMissing = "The thief cannot be found";
    inline constexpr const char* RamThief = "Ram the stolen car until it gives";
    inline constexpr const char* WaveKnock = "knock the crew down";
    inline constexpr const char* LoseOrGarage = "Lose the police or reach the garage";
    inline constexpr const char* TakeFare = "Pick up the passenger";
    inline constexpr const char* OrderGot = "ORDER TAKEN";
    inline constexpr const char* DoorWord = "DELIVERED";
    inline constexpr const char* ComeBack = "COME BACK";
    inline constexpr const char* TheatreNeeds = "The theatre needs you: 10 s";
    inline constexpr const char* Pasted = "PASTED";
    inline constexpr const char* GetIn = "GET IN";
    inline constexpr const char* StayInCar = "Stay in the car.";
    inline constexpr const char* DropFare = "Drop them off without leaving the car";
    inline constexpr const char* NotNow = "NOT NOW";
    inline constexpr const char* FinishScene = "Finish the Curator's scene first.";
    inline constexpr const char* StarsFirst = "Five stars first.";
    inline constexpr const char* Cut = "CUT";
    inline constexpr const char* LeftTheLight = "You left the light.";
    inline constexpr const char* BackToLight = "Come back into the light";
    inline constexpr const char* TheScene = "THE SCENE";
    inline constexpr const char* TwelveSeconds = "Twelve seconds in the light.";
    inline constexpr const char* Fists = "FISTS";
    inline constexpr const char* Stick = "HOCKEY STICK";
    inline constexpr const char* Pistol = "PISTOL";
    inline constexpr const char* Smg = "SMG";
    inline constexpr const char* Shotgun = "SHOTGUN";
    inline constexpr const char* Vest = "ARMOR VEST";
    inline constexpr const char* Medkit = "MEDKIT";
    inline constexpr const char* ArmorGain = "+50 armor";
    inline constexpr const char* HealthGain = "+50 health";
    inline constexpr const char* MeleeHint = "F or left click / strike";
    inline constexpr const char* Whack = "WHACK!";
    inline constexpr const char* Bang = "BANG!";
    inline constexpr const char* Boom = "BOOM!";
    inline constexpr const char* Warnings[] = {
        "Hey! Easy, people are here!",
        "Watch it! The park is not a race track!",
        "Whoa! Ease off, friend!"
    };
    inline constexpr const char* Greetings[] = {
        "Hi! A walk in the park feels good.",
        "Hello! A fine day to take it easy.",
        "You good? See you at the chalet."
    };
    inline constexpr int SpeechCount = 3;
    inline constexpr const char* Snack = "SNACK STAND";
    inline constexpr const char* SnackBusy = "Not during five stars";
    inline constexpr const char* SnackFine = "You are fine";
    inline constexpr const char* Kit = "Kit";
    inline constexpr const char* VestShort = "Vest";
    inline constexpr const char* OneStar = "One star";
    inline constexpr const char* NotEnough = "Not enough";
    inline constexpr const char* NothingToSell = "Nothing to sell.";
    inline constexpr const char* Calmer = "CALMER";
    inline constexpr const char* Shop = "SHOP";
    inline constexpr const char* NoCar = "No car";
    inline constexpr const char* Repair = "Repair";
    inline constexpr const char* NothingToFix = "NOTHING TO FIX";
    inline constexpr const char* BringACar = "Bring a damaged car.";
    inline constexpr const char* Fixed = "FIXED";
    inline constexpr const char* Lawn = "LAWN";
    inline constexpr const char* Alley = "ALLEY";
    inline constexpr const char* Bike = "BIKE";
    inline constexpr const char* ToTheAlley = "On to the alley.";
    inline constexpr const char* BackToStand = "Bring the bike to the stand.";
    inline constexpr const char* DoorWord1 = "DOOR 1";
    inline constexpr const char* DoorWord2 = "DOOR 2";
    inline constexpr const char* DoorWord3 = "DOOR 3";
    inline constexpr const char* ToDoor2 = "On to door 2.";
    inline constexpr const char* ToDoor3 = "On to door 3.";
    inline constexpr const char* Dip = "DIP";
    inline constexpr const char* BackToBank = "Come back to the bank.";
    inline constexpr const char* Crate = "CRATE";
    inline constexpr const char* TakeTheBike = "Take the bike. Persillier is waiting.";
    inline constexpr const char* Buoy = "BUOY";
    inline constexpr const char* BackToBridge = "Bring the pedalo to the bridge.";
    inline constexpr const char* Lap = "LAP";
    inline constexpr const char* Mechanic = "MECHANIC / BODY SHOP";
    inline constexpr const char* BowWord = "BOW";
    inline constexpr const char* CafeOrder = "CAFE / ORDER";
    inline constexpr const char* Passenger = "PASSENGER";
    inline constexpr const char* Quay = "QUAY";
    inline constexpr const char* CarWord = "CAR";
    inline constexpr const char* TheatreCap = "THEATRE";
    inline constexpr const char* Shore = "SHORE";
    inline constexpr const char* KitTitle = "KIT";
    inline constexpr const char* YouAreFine = "YOU ARE FINE";
    inline constexpr const char* Crack = "CRACK!";
    inline constexpr const char* Rattle = "RAT-A-TAT!";
    inline constexpr const char* Pow = "POW!";
    inline constexpr const char* CrewComing = "More of the crew is coming!";

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
