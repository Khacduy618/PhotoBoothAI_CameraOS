#import <Foundation/Foundation.h>
#import <Cocoa/Cocoa.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dlfcn.h>
#include <unistd.h>
#include <sys/time.h>
#include <pthread.h>
#include <semaphore.h>
#include <fcntl.h>

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
    EdsUInt32 padding[16];
} EdsDeviceInfo;

typedef struct {
    EdsUInt64 size;
    EdsUInt32 isFolder;
    EdsUInt32 groupID;
    EdsUInt32 option;
    char      szFileName[256];
    EdsUInt32 format;
    EdsUInt32 dateTime;
    EdsUInt32 reserved[16];
} EdsDirectoryItemInfo;

#define EDS_ERR_OK 0x00000000
#define kEdsPropID_ProductName        0x00000002
#define kEdsPropID_Evf_OutputDevice   0x00000500
#define kEdsPropID_SaveTo             0x0000000b
#define kEdsSaveTo_Host               0x00000002
#define kEdsSaveTo_Both               0x00000003
#define kEdsEvfOutputDevice_PC        0x00000002
#define kEdsCameraCommand_TakePicture                 0x00000000
#define kEdsCameraCommand_DoEvfAf                     0x00000102
#define kEdsCameraCommand_EvfAf_OFF                   0x00000000
#define kEdsCameraCommand_EvfAf_ON                    0x00000001
#define kEdsCameraCommand_PressShutterButton          0x00000004
#define kEdsCameraCommand_ShutterButton_OFF           0x00000000
#define kEdsCameraCommand_ShutterButton_Halfway       0x00000001
#define kEdsCameraCommand_ShutterButton_Completely    0x00000003
#define kEdsCameraCommand_ShutterButton_Halfway_NonAF 0x00000011
#define kEdsCameraCommand_ShutterButton_Completely_NonAF 0x00000013
#define kEdsObjectEvent_DirItemCreated 0x00000204
#define kEdsObjectEvent_DirItemRequestTransfer 0x00000208

typedef int EdsInt32;
typedef unsigned int EdsBool;

typedef struct {
    EdsInt32 numberOfFreeClusters;
    EdsInt32 bytesPerSector;
    EdsBool  reset;
} EdsCapacity;

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
typedef EdsError (*FnEdsSetCapacity)(EdsCameraRef inCameraRef, EdsCapacity inCapacity);
typedef EdsError (*FnEdsCreateMemoryStream)(EdsUInt32 inBufferSize, EdsStreamRef *outStreamRef);
typedef EdsError (*FnEdsCreateFileStream)(const char *inFileName, EdsUInt32 inCreateDisposition, EdsUInt32 inDesiredAccess, EdsStreamRef *outStreamRef);
typedef EdsError (*FnEdsCreateEvfImageRef)(EdsStreamRef inStreamRef, EdsEvfImageRef *outEvfImageRef);
typedef EdsError (*FnEdsDownloadEvfImage)(EdsCameraRef inCameraRef, EdsEvfImageRef inEvfImageRef);
typedef EdsError (*FnEdsGetLength)(EdsStreamRef inStreamRef, EdsUInt64 *outLength);
typedef EdsError (*FnEdsGetPointer)(EdsStreamRef inStreamRef, void **outPointer);
typedef EdsError (*FnEdsGetDirectoryItemInfo)(EdsDirectoryItemRef inDirItemRef, EdsDirectoryItemInfo *outDirItemInfo);
typedef EdsError (*FnEdsDownload)(EdsDirectoryItemRef inDirItemRef, EdsUInt64 inReadSize, EdsStreamRef outStreamRef);
typedef EdsError (*FnEdsDownloadComplete)(EdsDirectoryItemRef inDirItemRef);
typedef EdsError (*FnEdsSetObjectEventHandler)(EdsCameraRef inCameraRef, EdsObjectEvent inEvent, void *inHandler, void *inContext);
typedef EdsUInt32 (*FnEdsRelease)(EdsBaseRef inRef);
typedef EdsUInt32 (*FnEdsRetain)(EdsBaseRef inRef);

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
static FnEdsSetCapacity pEdsSetCapacity;
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
static FnEdsRetain pEdsRetain;

static void *g_edsdkHandle = NULL;
static EdsCameraListRef g_cameraList = NULL;
static EdsCameraRef g_camera = NULL;
static char g_cameraModel[256] = {0};
static volatile int g_sessionOpen = 0;
static volatile int g_liveViewActive = 0;
static volatile int g_running = 1;
static volatile int g_openSessionInProgress = 0;

static char g_pendingCaptureTargetPath[512] = {0};
static volatile int g_capturePending = 0;
static volatile int g_captureCompleted = 0;
static volatile int g_wasLiveViewBeforeCapture = 0;
static unsigned long g_downloadedFileSize = 0;
static int g_downloadedWidth = 0;
static int g_downloadedHeight = 0;

static pthread_mutex_t g_ioMutex = PTHREAD_MUTEX_INITIALIZER;

static double getTimestampMs(void) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return (tv.tv_sec * 1000.0) + (tv.tv_usec / 1000.0);
}

static void unlinkStaleSemaphores(void) {
    sem_unlink("edsdk");
    sem_unlink("/edsdk");
    sem_unlink("EdsLogTool");
    sem_unlink("/EdsLogTool");
}

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

static EdsError handleObjectEvent(EdsObjectEvent inEvent, EdsBaseRef inRef, void *inContext) {
    fprintf(stderr, "[CanonBridge] Object event received: 0x%08X\n", inEvent);

    if (inEvent == kEdsObjectEvent_DirItemCreated || inEvent == kEdsObjectEvent_DirItemRequestTransfer) {
        if (!g_capturePending && g_captureCompleted) {
            fprintf(stderr, "[CanonBridge] Ignoring extraneous object event 0x%08X (already completed)\n", inEvent);
            return EDS_ERR_OK;
        }
        EdsDirectoryItemRef dirItem = (EdsDirectoryItemRef)inRef;
        EdsDirectoryItemInfo dirInfo;
        memset(&dirInfo, 0, sizeof(dirInfo));

        EdsError err = pEdsGetDirectoryItemInfo(dirItem, &dirInfo);
        if (err != EDS_ERR_OK) {
            fprintf(stderr, "[CanonBridge] Failed to get dir item info: 0x%08X\n", err);
            sendJsonEvent(@{ @"event": @"error", @"code": @"GET_DIR_ITEM_INFO_FAILED", @"edsdkError": @(err) });
            return err;
        }

        fprintf(stderr, "[CanonBridge] Object ready: %s (size %llu bytes)\n", dirInfo.szFileName, dirInfo.size);
        sendJsonEvent(@{
            @"event": @"objectCreated",
            @"fileName": [NSString stringWithUTF8String:dirInfo.szFileName],
            @"size": @(dirInfo.size)
        });

        // Determine destination path
        NSString *destPath = nil;
        if (strlen(g_pendingCaptureTargetPath) > 0) {
            destPath = [NSString stringWithUTF8String:g_pendingCaptureTargetPath];
        } else {
            NSString *tempDir = NSTemporaryDirectory();
            NSString *uniqueName = [NSString stringWithFormat:@"canon_%lld_%s", (long long)[[NSDate date] timeIntervalSince1970], dirInfo.szFileName];
            destPath = [tempDir stringByAppendingPathComponent:uniqueName];
        }

        // Create file stream
        EdsStreamRef stream = NULL;
        err = pEdsCreateFileStream([destPath UTF8String], 1 /* kEdsFileCreate_CreateAlways */, 2 /* kEdsAccess_ReadWrite */, &stream);
        if (err != EDS_ERR_OK) {
            fprintf(stderr, "[CanonBridge] Failed to create file stream for %s: 0x%08X\n", [destPath UTF8String], err);
            sendJsonEvent(@{ @"event": @"error", @"code": @"CREATE_STREAM_FAILED", @"edsdkError": @(err) });
            return err;
        }

        fprintf(stderr, "[CanonBridge] Downloading to %s...\n", [destPath UTF8String]);
        err = pEdsDownload(dirItem, dirInfo.size, stream);
        if (err != EDS_ERR_OK) {
            fprintf(stderr, "[CanonBridge] Download failed: 0x%08X\n", err);
            pEdsRelease(stream);
            sendJsonEvent(@{ @"event": @"error", @"code": @"DOWNLOAD_FAILED", @"edsdkError": @(err) });
            return err;
        }

        pEdsDownloadComplete(dirItem);
        pEdsRelease(stream);

        // Parse downloaded image dimensions
        int width = 5472, height = 3648;
        NSData *fileData = [NSData dataWithContentsOfFile:destPath options:NSDataReadingMappedIfSafe error:nil];
        if (fileData && [fileData length] > 4) {
            int parsedW = 0, parsedH = 0;
            if (parseJpegMemoryDimensions([fileData bytes], MIN((size_t)[fileData length], (size_t)65536), &parsedW, &parsedH) == 0 && parsedW > 0 && parsedH > 0) {
                width = parsedW;
                height = parsedH;
            }
        }

        g_downloadedFileSize = (unsigned long)(fileData ? [fileData length] : (NSUInteger)dirInfo.size);
        g_downloadedWidth = width > 0 ? width : 5472;
        g_downloadedHeight = height > 0 ? height : 3648;
        g_captureCompleted = 1;
        g_capturePending = 0;

        fprintf(stderr, "[CanonBridge] Download completed successfully: %s (%lu bytes, %dx%d)\n",
                [destPath UTF8String], g_downloadedFileSize, g_downloadedWidth, g_downloadedHeight);

        sendJsonEvent(@{
            @"event": @"downloadCompleted",
            @"path": destPath,
            @"size": @(g_downloadedFileSize),
            @"width": @(g_downloadedWidth),
            @"height": @(g_downloadedHeight)
        });
    }
    return EDS_ERR_OK;
}

static int loadEdsdk(void) {
    if (g_edsdkHandle) return 1;

    const char *paths[] = {
        "/Applications/Canon Utilities/EOS Utility/EU3/EOS Utility 3.app/Contents/Frameworks/EDSDK.framework/Versions/A/EDSDK",
        "/Applications/Canon Utilities/EOS Utility/EOS Utility.app/Contents/Frameworks/EDSDK.framework/Versions/A/EDSDK",
        "/Library/Frameworks/EDSDK.framework/Versions/A/EDSDK",
        NULL
    };

    for (int i = 0; paths[i] != NULL; i++) {
        if (access(paths[i], R_OK) == 0) {
            g_edsdkHandle = dlopen(paths[i], RTLD_LAZY);
            if (g_edsdkHandle) {
                fprintf(stderr, "[CanonBridge] Loaded EDSDK from %s\n", paths[i]);
                break;
            }
        }
    }

    if (!g_edsdkHandle) {
        fprintf(stderr, "[CanonBridge] Failed to load EDSDK dynamic library: %s\n", dlerror());
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
    pEdsSetCapacity = (FnEdsSetCapacity)dlsym(g_edsdkHandle, "EdsSetCapacity");
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
    pEdsRetain = (FnEdsRetain)dlsym(g_edsdkHandle, "EdsRetain");
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
        fprintf(stderr, "[EDS_INITIALIZE_BEGIN] thread=0x%lx isMain=%d at=%.3f\n",
                (unsigned long)pthread_self(), pthread_main_np(), getTimestampMs());
        EdsError err = pEdsInitializeSDK();
        fprintf(stderr, "[EDS_INITIALIZE_END] result=0x%08X at=%.3f\n", err, getTimestampMs());
        if (err == EDS_ERR_OK) {
            sendJsonEvent(@{ @"event": @"initialized", @"status": @"ok" });
        } else {
            sendJsonEvent(@{ @"event": @"error", @"code": @"INITIALIZE_FAILED", @"edsdkError": @(err) });
        }
    } else if ([action isEqualToString:@"cleanStaleLock"]) {
        unlinkStaleSemaphores();
        sendJsonEvent(@{ @"event": @"staleLockCleaned", @"status": @"ok" });
    } else if ([action isEqualToString:@"enumerate"]) {
        if (!pEdsGetCameraList) {
            sendJsonEvent(@{ @"event": @"error", @"code": @"NOT_INITIALIZED" });
            return;
        }

        double enumBeginMs = getTimestampMs();

        // 1. Release previous camera and camera list references before acquiring fresh
        if (g_camera && pEdsRelease) {
            fprintf(stderr, "[DEBUG] Releasing stale cameraRef=%p\n", g_camera);
            pEdsRelease(g_camera);
            g_camera = NULL;
        }
        if (g_cameraList && pEdsRelease) {
            fprintf(stderr, "[DEBUG] Releasing stale cameraListRef=%p\n", g_cameraList);
            pEdsRelease(g_cameraList);
            g_cameraList = NULL;
        }

        // Stage 1: GET_CAMERA_LIST
        fprintf(stderr, "[GET_CAMERA_LIST_BEGIN] bridgePid=%d timestamp=%.3f\n", getpid(), getTimestampMs());
        double gclStart = getTimestampMs();
        EdsCameraListRef newList = NULL;
        EdsError err = pEdsGetCameraList(&newList);
        double gclElapsed = getTimestampMs() - gclStart;
        g_cameraList = newList;
        fprintf(stderr, "[GET_CAMERA_LIST_END] bridgePid=%d timestamp=%.3f elapsedMs=%.2f result=0x%08X cameraListRef=%p\n",
                getpid(), getTimestampMs(), gclElapsed, err, newList);

        // Stage 2: GET_CHILD_COUNT
        EdsUInt32 count = 0;
        EdsError childCountErr = 0xFFFFFFFF;
        double gccElapsed = 0.0;
        if (err == EDS_ERR_OK && newList) {
            fprintf(stderr, "[GET_CHILD_COUNT_BEGIN] bridgePid=%d timestamp=%.3f cameraListRef=%p\n", getpid(), getTimestampMs(), newList);
            double gccStart = getTimestampMs();
            childCountErr = pEdsGetChildCount(newList, &count);
            gccElapsed = getTimestampMs() - gccStart;
            fprintf(stderr, "[GET_CHILD_COUNT_END] bridgePid=%d timestamp=%.3f elapsedMs=%.2f result=0x%08X count=%u\n",
                    getpid(), getTimestampMs(), gccElapsed, childCountErr, count);
        }

        double elapsedMs = getTimestampMs() - enumBeginMs;
        fprintf(stderr, "[EDS_ENUM_AUDIT] bridgePid=%d threadId=0x%lx isMainThread=%d initializeCompleted=1 getCameraListResult=0x%08X cameraListRef=%p getChildCountResult=0x%08X cameraCount=%u elapsedMs=%.2f\n",
                getpid(), (unsigned long)pthread_self(), pthread_main_np(), err, newList, childCountErr, count, elapsedMs);

        if (count > 0 && newList) {
            // Stage 3: GET_CHILD_AT_INDEX
            fprintf(stderr, "[GET_CHILD_AT_INDEX_BEGIN] bridgePid=%d timestamp=%.3f index=0\n", getpid(), getTimestampMs());
            double gcaStart = getTimestampMs();
            EdsCameraRef cam = NULL;
            EdsError gcaErr = pEdsGetChildAtIndex(newList, 0, (EdsBaseRef*)&cam);
            double gcaElapsed = getTimestampMs() - gcaStart;
            g_camera = cam;
            fprintf(stderr, "[GET_CHILD_AT_INDEX_END] bridgePid=%d timestamp=%.3f elapsedMs=%.2f result=0x%08X cameraRef=%p\n",
                    getpid(), getTimestampMs(), gcaElapsed, gcaErr, g_camera);

            fprintf(stderr, "[DEBUG] CAMERA_LIST_REF = %p, CAMERA_REF = %p (count=%u)\n", g_cameraList, g_camera, count);

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
                @"port": [NSString stringWithUTF8String:devInfo.szPortName],
                @"cameraListRef": [NSString stringWithFormat:@"%p", g_cameraList],
                @"cameraRef": [NSString stringWithFormat:@"%p", g_camera],
                @"getCameraListMs": @(gclElapsed),
                @"getChildCountMs": @(gccElapsed)
            });
        } else {
            fprintf(stderr, "[EDS_ENUM_RESULT] SUCCESS_EMPTY_LIST (bridgePid=%d count=0 err=0x%08X)\n", getpid(), err);
            // Immediately release empty camera list to prevent stale caching
            if (g_cameraList && pEdsRelease) {
                pEdsRelease(g_cameraList);
                g_cameraList = NULL;
            }
            sendJsonEvent(@{
                @"event": @"cameraDiscovered",
                @"count": @0,
                @"result": @"SUCCESS_EMPTY_LIST",
                @"edsdkResult": @(err),
                @"getCameraListMs": @(gclElapsed),
                @"getChildCountMs": @(gccElapsed)
            });
        }
    } else if ([action isEqualToString:@"openSession"]) {
        if (!g_camera) {
            fprintf(stderr, "[DEBUG] openSession: g_camera is NULL!\n");
            sendJsonEvent(@{ @"event": @"error", @"code": @"NO_CAMERA" });
            return;
        }
        if (g_openSessionInProgress) {
            fprintf(stderr, "[DEBUG] openSession: attempt already in progress, skipping duplicate call.\n");
            return;
        }
        g_openSessionInProgress = 1;
        fprintf(stderr, "[EDS_OPEN_SESSION_BEGIN] thread=0x%lx isMain=%d cameraRef=%p at=%.3f\n",
                (unsigned long)pthread_self(), pthread_main_np(), g_camera, getTimestampMs());

        EdsError err = pEdsOpenSession(g_camera);

        fprintf(stderr, "[EDS_OPEN_SESSION_END] result=0x%08X at=%.3f\n", err, getTimestampMs());
        g_openSessionInProgress = 0;

        if (err == EDS_ERR_OK) {
            g_sessionOpen = 1;

            // 1. Read SaveTo before
            EdsUInt32 saveToBefore = 0;
            EdsError errSaveToBefore = pEdsGetPropertyData ? pEdsGetPropertyData(g_camera, kEdsPropID_SaveTo, 0, sizeof(saveToBefore), &saveToBefore) : 0xFFFFFFFF;

            // 2. Set SaveTo = Host
            EdsUInt32 saveTo = kEdsSaveTo_Host;
            EdsError errSetSaveTo = pEdsSetPropertyData ? pEdsSetPropertyData(g_camera, kEdsPropID_SaveTo, 0, sizeof(saveTo), &saveTo) : 0xFFFFFFFF;

            // 3. Set EdsCapacity
            EdsCapacity capacity;
            capacity.numberOfFreeClusters = 0x7FFFFFFF;
            capacity.bytesPerSector = 512;
            capacity.reset = 1;
            EdsError errSetCapacity = pEdsSetCapacity ? pEdsSetCapacity(g_camera, capacity) : 0xFFFFFFFF;

            // 4. Read SaveTo after
            EdsUInt32 saveToAfter = 0;
            EdsError errSaveToAfter = pEdsGetPropertyData ? pEdsGetPropertyData(g_camera, kEdsPropID_SaveTo, 0, sizeof(saveToAfter), &saveToAfter) : 0xFFFFFFFF;

            fprintf(stderr, "[EDS_CAPACITY_AUDIT] SAVE_TO_BEFORE=0x%08X (res=0x%08X) SET_SAVE_TO_HOST=0x%08X (res=0x%08X) SAVE_TO_AFTER=0x%08X (res=0x%08X) SET_CAPACITY=0x%08X\n",
                    saveToBefore, errSaveToBefore, saveTo, errSetSaveTo, saveToAfter, errSaveToAfter, errSetCapacity);

            pEdsSetObjectEventHandler(g_camera, 0x00000200 /* kEdsObjectEvent_All */, (void*)handleObjectEvent, NULL);
            sendJsonEvent(@{
                @"event": @"sessionOpened",
                @"status": @"ok",
                @"model": [NSString stringWithUTF8String:g_cameraModel],
                @"saveToBefore": @(saveToBefore),
                @"saveToAfter": @(saveToAfter),
                @"setSaveToRes": @(errSetSaveTo),
                @"setCapacityRes": @(errSetCapacity)
            });
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
    } else if ([action isEqualToString:@"autoFocus"]) {
        if (!g_sessionOpen || !g_camera || !g_liveViewActive) {
            sendJsonEvent(@{ @"event": @"error", @"code": @"AUTOFOCUS_NOT_ALLOWED", @"message": @"Session or LiveView not active." });
            return;
        }
        EdsError err = pEdsSendCommand(g_camera, kEdsCameraCommand_DoEvfAf, kEdsCameraCommand_EvfAf_ON);
        if (err == EDS_ERR_OK) {
            sendJsonEvent(@{ @"event": @"autoFocusStarted", @"status": @"ok" });
        } else {
            sendJsonEvent(@{ @"event": @"error", @"code": @"AUTOFOCUS_START_FAILED", @"edsdkError": @(err) });
        }
    } else if ([action isEqualToString:@"autoFocusStop"]) {
        if (g_camera) {
            EdsError err = pEdsSendCommand(g_camera, kEdsCameraCommand_DoEvfAf, kEdsCameraCommand_EvfAf_OFF);
            if (err == EDS_ERR_OK) {
                sendJsonEvent(@{ @"event": @"autoFocusStopped", @"status": @"ok" });
            } else {
                sendJsonEvent(@{ @"event": @"error", @"code": @"AUTOFOCUS_STOP_FAILED", @"edsdkError": @(err) });
            }
        } else {
            sendJsonEvent(@{ @"event": @"autoFocusStopped", @"status": @"ok" });
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

        BOOL isLastShot = [cmd[@"isLastShot"] boolValue];
        sendJsonEvent(@{ @"event": @"captureStarted", @"shotIndex": cmd[@"shotIndex"] ?: @1 });
        g_wasLiveViewBeforeCapture = isLastShot ? 0 : g_liveViewActive;
        if (isLastShot) {
            EdsUInt32 evfOff = 0;
            if (pEdsSetPropertyData) {
                pEdsSetPropertyData(g_camera, kEdsPropID_Evf_OutputDevice, 0, sizeof(evfOff), &evfOff);
            }
            g_liveViewActive = 0;
            fprintf(stderr, "[CanonBridge] Last shot requested: EVF resumption disabled.\n");
        }
        // Direct Single-Exposure Shutter Trigger from LiveView (eliminates double mirror slap)
        EdsError err = pEdsSendCommand(g_camera, kEdsCameraCommand_TakePicture, 0);
        NSString *usedCmd = @"TakePicture";
        if (err != EDS_ERR_OK) {
            usedCmd = @"PressShutterButton_Completely_NonAF";
            err = pEdsSendCommand(g_camera, kEdsCameraCommand_PressShutterButton, kEdsCameraCommand_ShutterButton_Completely_NonAF);
            usleep(50000);
            pEdsSendCommand(g_camera, kEdsCameraCommand_PressShutterButton, kEdsCameraCommand_ShutterButton_OFF);
        }
        if (err != EDS_ERR_OK) {
            usedCmd = @"PressShutterButton_Completely";
            err = pEdsSendCommand(g_camera, kEdsCameraCommand_PressShutterButton, kEdsCameraCommand_ShutterButton_Completely);
            usleep(50000);
            pEdsSendCommand(g_camera, kEdsCameraCommand_PressShutterButton, kEdsCameraCommand_ShutterButton_OFF);
        }

        fprintf(stderr, "[CAPTURE_AUDIT] COMMAND=%s RESULT=0x%08X\n", [usedCmd UTF8String], err);

        if (err == EDS_ERR_OK) {
            sendJsonEvent(@{ @"event": @"shutterDone", @"status": @"ok", @"command": usedCmd });
        } else {
            sendJsonEvent(@{ @"event": @"error", @"code": @"TAKE_PICTURE_FAILED", @"edsdkError": @(err), @"command": usedCmd });
            if (g_wasLiveViewBeforeCapture) {
                g_wasLiveViewBeforeCapture = 0;
                EdsUInt32 evfOn = kEdsEvfOutputDevice_PC;
                pEdsSetPropertyData(g_camera, kEdsPropID_Evf_OutputDevice, 0, sizeof(evfOn), &evfOn);
                g_liveViewActive = 1;
            }
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
            dispatch_async(dispatch_get_main_queue(), ^{
                processCommand(dict);
            });
            CFRunLoopWakeUp(CFRunLoopGetMain());
        }
    }
    g_running = 0;
    CFRunLoopWakeUp(CFRunLoopGetMain());
    return NULL;
}

static volatile sig_atomic_t g_shutdownRequested = 0;
static int g_resourcesReleased = 0;

static void releaseAllCanonResources(void) {
    if (g_resourcesReleased) return;
    g_resourcesReleased = 1;

    fprintf(stderr, "[NATIVE_SHUTDOWN_BEGIN] pid=%d\n", getpid());

    if (g_liveViewActive) {
        g_liveViewActive = 0;
        if (g_camera && pEdsSetPropertyData) {
            EdsUInt32 evfOff = 0;
            EdsError err = pEdsSetPropertyData(g_camera, kEdsPropID_Evf_OutputDevice, 0, sizeof(evfOff), &evfOff);
            fprintf(stderr, "[NATIVE_EVF_STOP] result=0x%08X\n", err);
        } else {
            fprintf(stderr, "[NATIVE_EVF_STOP] result=SKIPPED\n");
        }
    }

    if (g_camera && g_sessionOpen && pEdsCloseSession) {
        EdsError err = pEdsCloseSession(g_camera);
        g_sessionOpen = 0;
        fprintf(stderr, "[NATIVE_SESSION_CLOSE] result=0x%08X\n", err);
    } else {
        fprintf(stderr, "[NATIVE_SESSION_CLOSE] result=SKIPPED\n");
    }

    if (g_camera && pEdsRelease) {
        EdsError err = pEdsRelease(g_camera);
        g_camera = NULL;
        fprintf(stderr, "[NATIVE_CAMERA_RELEASE] result=0x%08X\n", err);
    } else {
        fprintf(stderr, "[NATIVE_CAMERA_RELEASE] result=SKIPPED\n");
    }

    if (g_cameraList && pEdsRelease) {
        EdsError err = pEdsRelease(g_cameraList);
        g_cameraList = NULL;
        fprintf(stderr, "[NATIVE_LIST_RELEASE] result=0x%08X\n", err);
    } else {
        fprintf(stderr, "[NATIVE_LIST_RELEASE] result=SKIPPED\n");
    }

    if (pEdsTerminateSDK) {
        EdsError err = pEdsTerminateSDK();
        fprintf(stderr, "[NATIVE_EDSDK_TERMINATE] result=0x%08X\n", err);
    } else {
        fprintf(stderr, "[NATIVE_EDSDK_TERMINATE] result=SKIPPED\n");
    }

    if (g_edsdkHandle) {
        int dlRes = dlclose(g_edsdkHandle);
        g_edsdkHandle = NULL;
        fprintf(stderr, "[NATIVE_DLCLOSE] result=%d\n", dlRes);
    } else {
        fprintf(stderr, "[NATIVE_DLCLOSE] result=SKIPPED\n");
    }

    fprintf(stderr, "[NATIVE_SHUTDOWN_COMPLETE] pid=%d\n", getpid());
}

static void cleanSignalShutdown(int sig) {
    g_shutdownRequested = 1;
    g_running = 0;
}

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        signal(SIGTERM, cleanSignalShutdown);
        signal(SIGINT, cleanSignalShutdown);
        signal(SIGHUP, cleanSignalShutdown);
        signal(SIGPIPE, SIG_IGN);

        NSApplicationLoad();
        [NSApplication sharedApplication];

        pthread_t tid;
        pthread_create(&tid, NULL, stdinReaderThread, NULL);

        sendJsonEvent(@{ @"event": @"bridgeReady", @"platform": @"macOS", @"arch": @"arm64" });

        uint64_t frameSeq = 0;
        while (g_running && !g_shutdownRequested) {
            @autoreleasepool {
                if (getppid() == 1) {
                    // Parent process died
                    g_shutdownRequested = 1;
                    g_running = 0;
                    break;
                }

                CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.005, false);

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
                                    if (frameSeq % 30 == 1) {
                                        fprintf(stderr, "[NATIVE_EVF] seq=%llu bytes=%llu width=%d height=%d at=%.3f\n",
                                                (unsigned long long)frameSeq, (unsigned long long)length, w, h, getTimestampMs());
                                    }
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

        releaseAllCanonResources();

        return 0;
    }
}
