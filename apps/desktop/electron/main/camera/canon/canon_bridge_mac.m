#import <Foundation/Foundation.h>
#import <Cocoa/Cocoa.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dlfcn.h>
#include <unistd.h>
#include <time.h>
#include <pthread.h>

// EDSDK Types & Constants
typedef unsigned int EdsError;
typedef void* EdsBaseRef;
typedef EdsBaseRef EdsCameraListRef;
typedef EdsBaseRef EdsCameraRef;
typedef EdsBaseRef EdsEvfImageRef;
typedef EdsBaseRef EdsStreamRef;
typedef EdsBaseRef EdsDirectoryItemRef;
typedef unsigned int EdsUInt32;
typedef unsigned long long EdsUInt64;
typedef unsigned int EdsPropertyID;
typedef unsigned int EdsObjectEvent;
typedef unsigned int EdsCameraCommand;

typedef struct {
    char szPortName[256];
    char szDeviceDescription[256];
    EdsUInt32 DeviceSubType;
    EdsUInt32 reserved;
} EdsDeviceInfo;

typedef struct {
    EdsUInt32 size;
    char szFileName[256];
    EdsUInt32 isFolder;
    EdsUInt32 groupID;
} EdsDirectoryItemInfo;

#define EDS_ERR_OK 0x00000000
#define kEdsPropID_ProductName        0x00000002
#define kEdsPropID_Evf_OutputDevice   0x00000500
#define kEdsPropID_SaveTo             0x0000000b
#define kEdsSaveTo_Host               0x00000002
#define kEdsSaveTo_Both               0x00000003
#define kEdsEvfOutputDevice_PC        0x00000002
#define kEdsCameraCommand_TakePicture 0x00000000
#define kEdsObjectEvent_DirItemCreated 0x00000204
#define kEdsObjectEvent_DirItemRequestTransfer 0x00000208

typedef EdsError (*FnEdsInitializeSDK)(void);
typedef EdsError (*FnEdsTerminateSDK)(void);
typedef EdsError (*FnEdsGetCameraList)(EdsCameraListRef *outCameraListRef);
typedef EdsError (*FnEdsGetChildCount)(EdsBaseRef inRef, EdsUInt32 *outCount);
typedef EdsError (*FnEdsGetChildAtIndex)(EdsBaseRef inRef, EdsUInt32 inIndex, EdsBaseRef *outBaseRef);
typedef EdsError (*FnEdsGetDeviceInfo)(EdsCameraRef inCameraRef, EdsDeviceInfo *outDeviceInfo);
typedef EdsError (*FnEdsGetPropertyData)(EdsBaseRef inRef, EdsPropertyID inPropertyID, EdsUInt32 inParam, EdsUInt32 inSize, void *outData);
typedef EdsError (*FnEdsOpenSession)(EdsCameraRef inCameraRef);
typedef EdsError (*FnEdsCloseSession)(EdsCameraRef inCameraRef);
typedef EdsError (*FnEdsSendCommand)(EdsCameraRef inCameraRef, EdsCameraCommand inCommand, EdsUInt32 inParam);
typedef EdsError (*FnEdsSetPropertyData)(EdsBaseRef inRef, EdsPropertyID inPropertyID, EdsUInt32 inParam, EdsUInt32 inSize, const void *inData);
typedef EdsError (*FnEdsCreateMemoryStream)(EdsUInt32 inBufferSize, EdsStreamRef *outStreamRef);
typedef EdsError (*FnEdsCreateFileStream)(const char *inFileName, EdsUInt32 inCreateDisposition, EdsUInt32 inDesiredAccess, EdsStreamRef *outStreamRef);
typedef EdsError (*FnEdsCreateEvfImageRef)(EdsStreamRef inStreamRef, EdsEvfImageRef *outEvfImageRef);
typedef EdsError (*FnEdsDownloadEvfImage)(EdsCameraRef inCameraRef, EdsEvfImageRef inEvfImageRef);
typedef EdsError (*FnEdsGetLength)(EdsStreamRef inStreamRef, EdsUInt64 *outLength);
typedef EdsError (*FnEdsGetPointer)(EdsStreamRef inStreamRef, void **outPointer);
typedef EdsError (*FnEdsGetDirectoryItemInfo)(EdsDirectoryItemRef inDirItemRef, EdsDirectoryItemInfo *outDirItemInfo);
typedef EdsError (*FnEdsDownload)(EdsDirectoryItemRef inDirItemRef, EdsUInt32 inReadSize, EdsStreamRef outStreamRef);
typedef EdsError (*FnEdsDownloadComplete)(EdsDirectoryItemRef inDirItemRef);
typedef EdsError (*FnEdsSetObjectEventHandler)(EdsCameraRef inCameraRef, EdsObjectEvent inEvent, void *inHandler, void *inContext);
typedef EdsUInt32 (*FnEdsRelease)(EdsBaseRef inRef);

static FnEdsInitializeSDK pEdsInitializeSDK;
static FnEdsTerminateSDK pEdsTerminateSDK;
static FnEdsGetCameraList pEdsGetCameraList;
static FnEdsGetChildCount pEdsGetChildCount;
static FnEdsGetChildAtIndex pEdsGetChildAtIndex;
static FnEdsGetDeviceInfo pEdsGetDeviceInfo;
static FnEdsGetPropertyData pEdsGetPropertyData;
static FnEdsOpenSession pEdsOpenSession;
static FnEdsCloseSession pEdsCloseSession;
static FnEdsSendCommand pEdsSendCommand;
static FnEdsSetPropertyData pEdsSetPropertyData;
static FnEdsCreateMemoryStream pEdsCreateMemoryStream;
static FnEdsCreateFileStream pEdsCreateFileStream;
static FnEdsCreateEvfImageRef pEdsCreateEvfImageRef;
static FnEdsDownloadEvfImage pEdsDownloadEvfImage;
static FnEdsGetLength pEdsGetLength;
static FnEdsGetPointer pEdsGetPointer;
static FnEdsGetDirectoryItemInfo pEdsGetDirectoryItemInfo;
static FnEdsDownload pEdsDownload;
static FnEdsDownloadComplete pEdsDownloadComplete;
static FnEdsSetObjectEventHandler pEdsSetObjectEventHandler;
static FnEdsRelease pEdsRelease;

static void *g_edsdkHandle = NULL;
static EdsCameraListRef g_cameraList = NULL;
static EdsCameraRef g_camera = NULL;
static char g_cameraModel[256] = {0};
static volatile int g_sessionOpen = 0;
static volatile int g_liveViewActive = 0;
static volatile int g_running = 1;

static char g_pendingCaptureTargetPath[512] = {0};
static volatile int g_capturePending = 0;
static volatile int g_captureCompleted = 0;
static unsigned long g_downloadedFileSize = 0;
static int g_downloadedWidth = 0;
static int g_downloadedHeight = 0;

static pthread_mutex_t g_ioMutex = PTHREAD_MUTEX_INITIALIZER;

static void sendJsonEvent(NSDictionary *dict) {
    NSError *error = nil;
    NSData *data = [NSJSONSerialization dataWithJSONObject:dict options:0 error:&error];
    if (data && !error) {
        NSString *jsonStr = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        pthread_mutex_lock(&g_ioMutex);
        printf("%s\n", [jsonStr UTF8String]);
        fflush(stdout);
        pthread_mutex_unlock(&g_ioMutex);
    }
}

static int parseJpegMemoryDimensions(const unsigned char *data, size_t size, int *width, int *height) {
    if (!data || size < 4) return 0;
    if (data[0] != 0xFF || data[1] != 0xD8) return 0;

    size_t i = 2;
    while (i + 4 < size) {
        if (data[i] != 0xFF) {
            i++;
            continue;
        }
        unsigned char marker = data[i + 1];
        if (marker == 0xD9 || marker == 0xDA) break;

        unsigned short blockLength = (data[i + 2] << 8) | data[i + 3];
        if (marker == 0xC0 || marker == 0xC1 || marker == 0xC2) {
            if (i + 8 < size) {
                *height = (data[i + 5] << 8) | data[i + 6];
                *width = (data[i + 7] << 8) | data[i + 8];
                return 1;
            }
            break;
        }
        if (blockLength < 2) break;
        i += 2 + blockLength;
    }
    return 0;
}

static int parseJpegFileDimensions(const char *path, int *width, int *height) {
    FILE *f = fopen(path, "rb");
    if (!f) return 0;
    fseek(f, 0, SEEK_END);
    long sz = ftell(f);
    fseek(f, 0, SEEK_SET);
    if (sz <= 4) { fclose(f); return 0; }

    unsigned char *buf = malloc(sz);
    if (!buf) { fclose(f); return 0; }
    fread(buf, 1, sz, f);
    fclose(f);

    int res = parseJpegMemoryDimensions(buf, (size_t)sz, width, height);
    free(buf);
    return res;
}

EdsError handleObjectEvent(EdsObjectEvent inEvent, EdsBaseRef inRef, void *inContext) {
    if (inEvent == kEdsObjectEvent_DirItemCreated || inEvent == kEdsObjectEvent_DirItemRequestTransfer) {
        EdsDirectoryItemRef dirItem = (EdsDirectoryItemRef)inRef;
        EdsDirectoryItemInfo itemInfo;
        memset(&itemInfo, 0, sizeof(itemInfo));
        EdsError err = pEdsGetDirectoryItemInfo(dirItem, &itemInfo);
        if (err == EDS_ERR_OK) {
            sendJsonEvent(@{
                @"event": @"objectCreated",
                @"fileName": [NSString stringWithUTF8String:itemInfo.szFileName],
                @"size": @(itemInfo.size)
            });

            char targetPath[512] = {0};
            if (strlen(g_pendingCaptureTargetPath) > 0) {
                strncpy(targetPath, g_pendingCaptureTargetPath, sizeof(targetPath) - 1);
            } else {
                snprintf(targetPath, sizeof(targetPath), "/tmp/canon_capture_%lu_%s", time(NULL), itemInfo.szFileName);
            }

            NSString *nsTarget = [NSString stringWithUTF8String:targetPath];
            [[NSFileManager defaultManager] createDirectoryAtPath:[nsTarget stringByDeletingLastPathComponent] withIntermediateDirectories:YES attributes:nil error:nil];

            EdsStreamRef fileStream = NULL;
            err = pEdsCreateFileStream(targetPath, 1 /* CreateAlways */, 2 /* ReadWrite */, &fileStream);
            if (err == EDS_ERR_OK && fileStream) {
                sendJsonEvent(@{ @"event": @"downloadStarted", @"targetPath": nsTarget });
                err = pEdsDownload(dirItem, itemInfo.size, fileStream);
                if (err == EDS_ERR_OK) {
                    pEdsDownloadComplete(dirItem);
                    
                    FILE *chk = fopen(targetPath, "rb");
                    if (chk) {
                        fseek(chk, 0, SEEK_END);
                        g_downloadedFileSize = (unsigned long)ftell(chk);
                        fclose(chk);
                    }
                    parseJpegFileDimensions(targetPath, &g_downloadedWidth, &g_downloadedHeight);

                    sendJsonEvent(@{
                        @"event": @"downloadCompleted",
                        @"path": nsTarget,
                        @"size": @(g_downloadedFileSize),
                        @"width": @(g_downloadedWidth),
                        @"height": @(g_downloadedHeight)
                    });
                    g_captureCompleted = 1;
                } else {
                    sendJsonEvent(@{ @"event": @"error", @"code": @"DOWNLOAD_FAILED", @"edsdkError": @(err) });
                }
                pEdsRelease(fileStream);
            }
        }
    }
    return EDS_ERR_OK;
}

static int loadEdsdk() {
    if (g_edsdkHandle) return 1;
    const char *frameworkPath = "/Applications/Canon Utilities/EOS Utility/EU3/EOS Utility 3.app/Contents/Frameworks/EDSDK.framework/Versions/A/EDSDK";
    g_edsdkHandle = dlopen(frameworkPath, RTLD_LAZY);
    if (!g_edsdkHandle) {
        fprintf(stderr, "[CanonBridge] dlopen error: %s\n", dlerror());
        return 0;
    }
    pEdsInitializeSDK = (FnEdsInitializeSDK)dlsym(g_edsdkHandle, "EdsInitializeSDK");
    pEdsTerminateSDK = (FnEdsTerminateSDK)dlsym(g_edsdkHandle, "EdsTerminateSDK");
    pEdsGetCameraList = (FnEdsGetCameraList)dlsym(g_edsdkHandle, "EdsGetCameraList");
    pEdsGetChildCount = (FnEdsGetChildCount)dlsym(g_edsdkHandle, "EdsGetChildCount");
    pEdsGetChildAtIndex = (FnEdsGetChildAtIndex)dlsym(g_edsdkHandle, "EdsGetChildAtIndex");
    pEdsGetDeviceInfo = (FnEdsGetDeviceInfo)dlsym(g_edsdkHandle, "EdsGetDeviceInfo");
    pEdsGetPropertyData = (FnEdsGetPropertyData)dlsym(g_edsdkHandle, "EdsGetPropertyData");
    pEdsOpenSession = (FnEdsOpenSession)dlsym(g_edsdkHandle, "EdsOpenSession");
    pEdsCloseSession = (FnEdsCloseSession)dlsym(g_edsdkHandle, "EdsCloseSession");
    pEdsSendCommand = (FnEdsSendCommand)dlsym(g_edsdkHandle, "EdsSendCommand");
    pEdsSetPropertyData = (FnEdsSetPropertyData)dlsym(g_edsdkHandle, "EdsSetPropertyData");
    pEdsCreateMemoryStream = (FnEdsCreateMemoryStream)dlsym(g_edsdkHandle, "EdsCreateMemoryStream");
    pEdsCreateFileStream = (FnEdsCreateFileStream)dlsym(g_edsdkHandle, "EdsCreateFileStream");
    pEdsCreateEvfImageRef = (FnEdsCreateEvfImageRef)dlsym(g_edsdkHandle, "EdsCreateEvfImageRef");
    pEdsDownloadEvfImage = (FnEdsDownloadEvfImage)dlsym(g_edsdkHandle, "EdsDownloadEvfImage");
    pEdsGetLength = (FnEdsGetLength)dlsym(g_edsdkHandle, "EdsGetLength");
    pEdsGetPointer = (FnEdsGetPointer)dlsym(g_edsdkHandle, "EdsGetPointer");
    pEdsGetDirectoryItemInfo = (FnEdsGetDirectoryItemInfo)dlsym(g_edsdkHandle, "EdsGetDirectoryItemInfo");
    pEdsDownload = (FnEdsDownload)dlsym(g_edsdkHandle, "EdsDownload");
    pEdsDownloadComplete = (FnEdsDownloadComplete)dlsym(g_edsdkHandle, "EdsDownloadComplete");
    pEdsSetObjectEventHandler = (FnEdsSetObjectEventHandler)dlsym(g_edsdkHandle, "EdsSetObjectEventHandler");
    pEdsRelease = (FnEdsRelease)dlsym(g_edsdkHandle, "EdsRelease");
    return 1;
}

static void processCommand(NSDictionary *cmd) {
    NSString *action = cmd[@"command"];
    if (!action) return;
    fprintf(stderr, "[DEBUG] Processing command: %s\n", [action UTF8String]);

    if ([action isEqualToString:@"initialize"]) {
        if (!loadEdsdk()) {
            sendJsonEvent(@{ @"event": @"error", @"code": @"DLOPEN_FAILED" });
            return;
        }
        EdsError err = pEdsInitializeSDK();
        fprintf(stderr, "[DEBUG] EdsInitializeSDK returned 0x%08X\n", err);
        if (err == EDS_ERR_OK) {
            sendJsonEvent(@{ @"event": @"initialized", @"status": @"ok" });
        } else {
            sendJsonEvent(@{ @"event": @"error", @"code": @"INITIALIZE_FAILED", @"edsdkError": @(err) });
        }
    } else if ([action isEqualToString:@"enumerate"]) {
        if (!pEdsGetCameraList) {
            sendJsonEvent(@{ @"event": @"error", @"code": @"NOT_INITIALIZED" });
            return;
        }
        EdsError err = pEdsGetCameraList(&g_cameraList);
        fprintf(stderr, "[DEBUG] EdsGetCameraList returned 0x%08X\n", err);
        EdsUInt32 count = 0;
        if (err == EDS_ERR_OK && g_cameraList) {
            pEdsGetChildCount(g_cameraList, &count);
            fprintf(stderr, "[DEBUG] EdsGetChildCount returned count: %u\n", count);
        }
        if (count > 0) {
            EdsCameraRef cam = NULL;
            pEdsGetChildAtIndex(g_cameraList, 0, (EdsBaseRef*)&cam);
            g_camera = cam;
            EdsDeviceInfo devInfo;
            memset(&devInfo, 0, sizeof(devInfo));
            pEdsGetDeviceInfo(g_camera, &devInfo);

            char prod[256] = {0};
            if (pEdsGetPropertyData) {
                pEdsGetPropertyData(g_camera, kEdsPropID_ProductName, 0, sizeof(prod), prod);
            }
            snprintf(g_cameraModel, sizeof(g_cameraModel), "%s", strlen(prod) > 0 ? prod : devInfo.szDeviceDescription);
            fprintf(stderr, "[DEBUG] Camera model: %s, port: %s\n", g_cameraModel, devInfo.szPortName);
            sendJsonEvent(@{
                @"event": @"cameraDiscovered",
                @"count": @(count),
                @"model": [NSString stringWithUTF8String:g_cameraModel],
                @"port": [NSString stringWithUTF8String:devInfo.szPortName]
            });
        } else {
            sendJsonEvent(@{ @"event": @"cameraDiscovered", @"count": @0 });
        }
    } else if ([action isEqualToString:@"openSession"]) {
        if (!g_camera) {
            fprintf(stderr, "[DEBUG] openSession: g_camera is NULL!\n");
            sendJsonEvent(@{ @"event": @"error", @"code": @"NO_CAMERA" });
            return;
        }
        fprintf(stderr, "[DEBUG] Calling EdsOpenSession...\n");
        EdsError err = pEdsOpenSession(g_camera);
        fprintf(stderr, "[DEBUG] EdsOpenSession returned 0x%08X\n", err);
        if (err == EDS_ERR_OK) {
            g_sessionOpen = 1;
            EdsUInt32 saveTo = kEdsSaveTo_Both;
            pEdsSetPropertyData(g_camera, kEdsPropID_SaveTo, 0, sizeof(saveTo), &saveTo);
            pEdsSetObjectEventHandler(g_camera, 0x00000200 /* kEdsObjectEvent_All */, (void*)handleObjectEvent, NULL);
            sendJsonEvent(@{ @"event": @"sessionOpened", @"status": @"ok", @"model": [NSString stringWithUTF8String:g_cameraModel] });
        } else {
            sendJsonEvent(@{ @"event": @"error", @"code": @"OPEN_SESSION_FAILED", @"edsdkError": @(err) });
        }
    } else if ([action isEqualToString:@"startLiveView"]) {
        if (!g_sessionOpen || !g_camera) {
            sendJsonEvent(@{ @"event": @"error", @"code": @"SESSION_NOT_OPEN" });
            return;
        }
        EdsUInt32 evfDevice = kEdsEvfOutputDevice_PC;
        EdsError err = pEdsSetPropertyData(g_camera, kEdsPropID_Evf_OutputDevice, 0, sizeof(evfDevice), &evfDevice);
        if (err == EDS_ERR_OK) {
            g_liveViewActive = 1;
            sendJsonEvent(@{ @"event": @"liveViewStarted", @"status": @"ok" });
        } else {
            sendJsonEvent(@{ @"event": @"error", @"code": @"START_EVF_FAILED", @"edsdkError": @(err) });
        }
    } else if ([action isEqualToString:@"stopLiveView"]) {
        if (g_camera) {
            EdsUInt32 evfDevice = 0;
            pEdsSetPropertyData(g_camera, kEdsPropID_Evf_OutputDevice, 0, sizeof(evfDevice), &evfDevice);
            g_liveViewActive = 0;
            sendJsonEvent(@{ @"event": @"liveViewStopped", @"status": @"ok" });
        }
    } else if ([action isEqualToString:@"capture"]) {
        if (!g_sessionOpen || !g_camera) {
            sendJsonEvent(@{ @"event": @"error", @"code": @"SESSION_NOT_OPEN" });
            return;
        }
        NSString *targetPath = cmd[@"targetPath"];
        if (targetPath) {
            strncpy(g_pendingCaptureTargetPath, [targetPath UTF8String], sizeof(g_pendingCaptureTargetPath) - 1);
        } else {
            g_pendingCaptureTargetPath[0] = '\0';
        }
        g_capturePending = 1;
        g_captureCompleted = 0;

        sendJsonEvent(@{ @"event": @"captureStarted", @"shotIndex": cmd[@"shotIndex"] ?: @1 });
        EdsError err = pEdsSendCommand(g_camera, kEdsCameraCommand_TakePicture, 0);
        if (err == EDS_ERR_OK) {
            sendJsonEvent(@{ @"event": @"shutterDone", @"status": @"ok" });
        } else {
            sendJsonEvent(@{ @"event": @"error", @"code": @"TAKE_PICTURE_FAILED", @"edsdkError": @(err) });
        }
    } else if ([action isEqualToString:@"closeSession"]) {
        if (g_camera && g_sessionOpen) {
            if (g_liveViewActive) {
                EdsUInt32 evfDevice = 0;
                pEdsSetPropertyData(g_camera, kEdsPropID_Evf_OutputDevice, 0, sizeof(evfDevice), &evfDevice);
                g_liveViewActive = 0;
            }
            pEdsCloseSession(g_camera);
            g_sessionOpen = 0;
            sendJsonEvent(@{ @"event": @"sessionClosed", @"status": @"ok" });
        }
    } else if ([action isEqualToString:@"shutdown"]) {
        g_running = 0;
    }
}

static void *stdinReaderThread(void *arg) {
    char line[4096];
    while (g_running && fgets(line, sizeof(line), stdin)) {
        size_t len = strlen(line);
        if (len > 0 && line[len - 1] == '\n') line[len - 1] = '\0';
        if (strlen(line) == 0) continue;

        NSData *data = [NSData dataWithBytes:line length:strlen(line)];
        NSError *err = nil;
        NSDictionary *dict = [NSJSONSerialization JSONObjectWithData:data options:0 error:&err];
        if (dict && !err) {
            CFRunLoopPerformBlock(CFRunLoopGetMain(), kCFRunLoopCommonModes, ^{
                processCommand(dict);
            });
            CFRunLoopWakeUp(CFRunLoopGetMain());
        }
    }
    g_running = 0;
    CFRunLoopWakeUp(CFRunLoopGetMain());
    return NULL;
}

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        NSApplicationLoad();
        [NSApplication sharedApplication];

        pthread_t tid;
        pthread_create(&tid, NULL, stdinReaderThread, NULL);

        sendJsonEvent(@{ @"event": @"bridgeReady", @"platform": @"macOS", @"arch": @"arm64" });

        uint64_t frameSeq = 0;
        while (g_running) {
            @autoreleasepool {
                [[NSRunLoop currentRunLoop] runMode:NSDefaultRunLoopMode beforeDate:[NSDate dateWithTimeIntervalSinceNow:0.02]];

                if (g_liveViewActive && g_sessionOpen && g_camera) {
                    EdsStreamRef evfStream = NULL;
                    pEdsCreateMemoryStream(0, &evfStream);
                    if (evfStream) {
                        EdsEvfImageRef evfImage = NULL;
                        pEdsCreateEvfImageRef(evfStream, &evfImage);
                        if (evfImage) {
                            EdsError err = pEdsDownloadEvfImage(g_camera, evfImage);
                            if (err == EDS_ERR_OK) {
                                EdsUInt64 length = 0;
                                pEdsGetLength(evfStream, &length);
                                void *ptr = NULL;
                                pEdsGetPointer(evfStream, &ptr);

                                if (ptr && length > 4) {
                                    int w = 0, h = 0;
                                    parseJpegMemoryDimensions((unsigned char*)ptr, (size_t)length, &w, &h);
                                    NSData *jpegData = [NSData dataWithBytes:ptr length:(NSUInteger)length];
                                    NSString *base64 = [jpegData base64EncodedStringWithOptions:0];
                                    NSString *dataUrl = [NSString stringWithFormat:@"data:image/jpeg;base64,%@", base64];

                                    frameSeq++;
                                    sendJsonEvent(@{
                                        @"event": @"liveViewFrame",
                                        @"seq": @(frameSeq),
                                        @"dataUrl": dataUrl,
                                        @"width": @(w),
                                        @"height": @(h),
                                        @"size": @(length)
                                    });
                                }
                            }
                            pEdsRelease(evfImage);
                        }
                        pEdsRelease(evfStream);
                    }
                }
            }
        }

        if (g_camera && g_sessionOpen) {
            pEdsCloseSession(g_camera);
        }
        if (g_camera) pEdsRelease(g_camera);
        if (g_cameraList) pEdsRelease(g_cameraList);
        if (pEdsTerminateSDK) pEdsTerminateSDK();
        if (g_edsdkHandle) dlclose(g_edsdkHandle);

        return 0;
    }
}
