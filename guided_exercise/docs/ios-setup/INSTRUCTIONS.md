# iOS QuickPose Setup (run on Mac)

These steps must be performed on a Mac after Android setup is complete.

## 1. Generate the iOS native project

```bash
cd guided_exercise
npx expo prebuild --platform ios
```

## 2. Add QuickPose to the Podfile

In `ios/Podfile`, inside the main target block, add:

```ruby
pod 'QuickPoseCore', '~> 0.5'
```

## 3. Install pods

```bash
cd ios
pod install
cd ..
```

## 4. Copy native module files

Copy both files from `docs/ios-setup/` into your iOS app source folder
(typically `ios/guided_exercise/` or `ios/guidedexercise/`):

```
QuickPoseVideoModule.swift
QuickPoseVideoModule.m
```

## 5. Add to Xcode project

Open `ios/guided_exercise.xcworkspace` in Xcode and drag both files
into the app target. Ensure "Copy items if needed" is checked.

## 6. Add your SDK key

In `QuickPoseVideoModule.swift`, replace `"YOUR_QUICKPOSE_SDK_KEY"` with
the key obtained from https://quickpose.ai

## 7. Build for iOS

```bash
cd guided_exercise
npx expo run:ios
```

## Notes on QuickPose API

The Swift file uses `QuickPoseResult.angle(for:)` to extract angle values.
If your version of the QuickPose iOS SDK uses different method or property
names, update `buildFrameMap()` in `QuickPoseVideoModule.swift` accordingly.
Refer to https://docs.quickpose.ai for the current iOS SDK API reference.
