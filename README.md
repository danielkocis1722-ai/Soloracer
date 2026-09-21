# Soloracer

Soloracer is an offline-first GPS timing and rally-style driving companion for Android and iOS.

## MVP

- Create a trail by recording a route with GPS
- Edit start, finish and checkpoint positions
- Drive mode with automatic start/finish detection
- Checkpoint split times
- Offline-first run storage with SQLite
- Rally-style voice pace notes
- Post-run rating and driving-condition notes
- Cloud sync later, when internet is available

## Tech stack

- Expo SDK 57
- React Native + TypeScript
- Expo Router
- expo-location
- expo-sqlite
- expo-speech
- expo-keep-awake

## First run

```bash
git clone https://github.com/danielkocis1722-ai/Soloracer.git
cd Soloracer
npm install
npx expo start
```

For a real device, grant foreground location permission when Drive mode asks for it.

## Initial flow

`Home -> Create Trail -> Edit Trail -> Drive -> Auto start -> Checkpoints -> Finish -> Results`

## Safety

Soloracer is intended for legal driving environments such as closed courses, private roads, track use, and non-competitive route logging. Do not interact with the phone while driving.
