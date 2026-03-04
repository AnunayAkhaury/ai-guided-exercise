// ObjC bridge — copy to ios/<AppName>/QuickPoseVideoModule.m after expo prebuild
#import <React/RCTBridgeModule.h>

RCT_EXTERN_MODULE(QuickPoseVideoModule, NSObject)

RCT_EXTERN_METHOD(analyzeVideo:(NSString *)videoUrl
                  exercise:(NSString *)exercise
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
