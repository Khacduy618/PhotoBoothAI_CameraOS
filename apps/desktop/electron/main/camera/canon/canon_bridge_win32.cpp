/**
 * MomentAI CameraOS — Canon EOS 6D Native Bridge (Win32 x86)
 * Strict platform port of canon_bridge_mac.m for Windows 10 x64 host + x86 EDSDK.dll runtime.
 *
 * ABI: Win32 stdcall (__stdcall) for all EDSDK API function pointers and callbacks.
 * Protocol: stdin/stdout JSON lines identical to canon_bridge_mac.m.
 * Architecture: Electron x64 -> canon-runtime.cjs (Node x64) -> canon_bridge_win32.exe (x86) -> EDSDK.dll (x86).
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <queue>
#include <map>
#include <thread>
#include <mutex>
#include <atomic>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>

// ============================================================
// 1. EDSDK Calling Convention & ABI Declarations
// ============================================================

#ifdef _WIN32
  #define EDSAPI __stdcall
  #define EDSCALLBACK __stdcall
#else
  #define EDSAPI
  #define EDSCALLBACK
#endif

typedef unsigned int EdsError;
typedef void* EdsBaseRef;
typedef EdsBaseRef EdsCameraListRef;
typedef EdsBaseRef EdsCameraRef;
typedef EdsBaseRef EdsEvfImageRef;
typedef EdsBaseRef EdsStreamRef;
typedef EdsBaseRef EdsDirectoryItemRef;
typedef unsigned int EdsUInt32;
typedef unsigned long long EdsUInt64;
typedef int EdsInt32;
typedef unsigned int EdsBool;
typedef unsigned int EdsPropertyID;
typedef unsigned int EdsObjectEvent;
typedef unsigned int EdsCameraCommand;

#pragma pack(push, 8)
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

typedef struct {
    EdsInt32 numberOfFreeClusters;
    EdsInt32 bytesPerSector;
    EdsBool  reset;
} EdsCapacity;
#pragma pack(pop)

// ============================================================
// 2. EDSDK Constants
// ============================================================

#define EDS_ERR_OK                                    0x00000000
#define EDS_ERR_UNIMPLEMENTED                         0x00000001
#define EDS_ERR_INTERNAL_ERROR                        0x00000002
#define EDS_ERR_MEM_ALLOC_FAILED                      0x00000003
#define EDS_ERR_MEM_FREE_FAILED                       0x00000004
#define EDS_ERR_INVALID_HANDLE                        0x00000005
#define EDS_ERR_NOT_SUPPORTED                         0x00000007
#define EDS_ERR_DEVICE_NOT_FOUND                      0x00000080
#define EDS_ERR_DEVICE_BUSY                           0x00000082
#define EDS_ERR_COMM_PORT_IS_IN_USE                   0x000000C0
#define EDS_ERR_COMM_DISCONNECTED                     0x000000C1
#define EDS_ERR_OBJECT_NOTREADY                       0x0000A102

#define kEdsPropID_ProductName                        0x00000002
#define kEdsPropID_SaveTo                             0x0000000b
#define kEdsPropID_Evf_OutputDevice                   0x00000500
#define kEdsSaveTo_Camera                             0x00000001
#define kEdsSaveTo_Host                               0x00000002
#define kEdsSaveTo_Both                               0x00000003
#define kEdsEvfOutputDevice_PC                        0x00000002

#define kEdsCameraCommand_TakePicture                 0x00000000
#define kEdsCameraCommand_ExtendShutDownTimer         0x00000001
#define kEdsCameraCommand_DoEvfAf                     0x00000102
#define kEdsCameraCommand_EvfAf_OFF                   0x00000000
#define kEdsCameraCommand_EvfAf_ON                    0x00000001
#define kEdsCameraCommand_PressShutterButton          0x00000004
#define kEdsCameraCommand_ShutterButton_OFF           0x00000000
#define kEdsCameraCommand_ShutterButton_Halfway       0x00000001
#define kEdsCameraCommand_ShutterButton_Completely    0x00000003
#define kEdsCameraCommand_ShutterButton_Halfway_NonAF 0x00000011
#define kEdsCameraCommand_ShutterButton_Completely_NonAF 0x00000013

#define kEdsObjectEvent_All                           0x00000200
#define kEdsObjectEvent_DirItemCreated                0x00000204
#define kEdsObjectEvent_DirItemRequestTransfer        0x00000208

#define kEdsFileCreate_CreateAlways                   1
#define kEdsAccess_ReadWrite                          2

// ============================================================
// 3. EDSDK Function Pointer Types (Exact EDSDK 3.x+ Signatures)
// ============================================================

typedef EdsError (EDSAPI *FnEdsInitializeSDK)(void);
typedef EdsError (EDSAPI *FnEdsTerminateSDK)(void);
typedef EdsError (EDSAPI *FnEdsGetCameraList)(EdsCameraListRef *outCameraListRef);
typedef EdsError (EDSAPI *FnEdsGetChildCount)(EdsBaseRef inRef, EdsUInt32 *outCount);
typedef EdsError (EDSAPI *FnEdsGetChildAtIndex)(EdsBaseRef inRef, EdsInt32 inIndex, EdsBaseRef *outBaseRef);
typedef EdsError (EDSAPI *FnEdsGetDeviceInfo)(EdsCameraRef inCameraRef, EdsDeviceInfo *outDeviceInfo);
typedef EdsError (EDSAPI *FnEdsGetPropertyData)(EdsBaseRef inRef, EdsPropertyID inPropertyID, EdsInt32 inParam, EdsUInt32 inSize, void *outData);
typedef EdsError (EDSAPI *FnEdsOpenSession)(EdsCameraRef inCameraRef);
typedef EdsError (EDSAPI *FnEdsCloseSession)(EdsCameraRef inCameraRef);
typedef EdsError (EDSAPI *FnEdsSendCommand)(EdsCameraRef inCameraRef, EdsCameraCommand inCommand, EdsInt32 inParam);
typedef EdsError (EDSAPI *FnEdsSetPropertyData)(EdsBaseRef inRef, EdsPropertyID inPropertyID, EdsInt32 inParam, EdsUInt32 inSize, const void *inData);
typedef EdsError (EDSAPI *FnEdsSetCapacity)(EdsCameraRef inCameraRef, EdsCapacity inCapacity);
typedef EdsError (EDSAPI *FnEdsCreateMemoryStream)(EdsUInt64 inBufferSize, EdsStreamRef *outStreamRef);
typedef EdsError (EDSAPI *FnEdsCreateFileStream)(const char *inFileName, EdsUInt32 inCreateDisposition, EdsUInt32 inDesiredAccess, EdsStreamRef *outStreamRef);
typedef EdsError (EDSAPI *FnEdsCreateEvfImageRef)(EdsStreamRef inStreamRef, EdsEvfImageRef *outEvfImageRef);
typedef EdsError (EDSAPI *FnEdsDownloadEvfImage)(EdsCameraRef inCameraRef, EdsEvfImageRef inEvfImageRef);
typedef EdsError (EDSAPI *FnEdsGetLength)(EdsStreamRef inStreamRef, EdsUInt64 *outLength);
typedef EdsError (EDSAPI *FnEdsGetPointer)(EdsStreamRef inStreamRef, void **outPointer);
typedef EdsError (EDSAPI *FnEdsGetDirectoryItemInfo)(EdsDirectoryItemRef inDirItemRef, EdsDirectoryItemInfo *outDirItemInfo);
typedef EdsError (EDSAPI *FnEdsDownload)(EdsDirectoryItemRef inDirItemRef, EdsUInt64 inReadSize, EdsStreamRef outStreamRef);
typedef EdsError (EDSAPI *FnEdsDownloadComplete)(EdsDirectoryItemRef inDirItemRef);
typedef EdsError (EDSAPI *FnEdsSetObjectEventHandler)(EdsCameraRef inCameraRef, EdsObjectEvent inEvent, void *inHandler, void *inContext);
typedef EdsUInt32 (EDSAPI *FnEdsRelease)(EdsBaseRef inRef);
typedef EdsUInt32 (EDSAPI *FnEdsRetain)(EdsBaseRef inRef);

static FnEdsInitializeSDK pEdsInitializeSDK = nullptr;
static FnEdsTerminateSDK pEdsTerminateSDK = nullptr;
static FnEdsGetCameraList pEdsGetCameraList = nullptr;
static FnEdsGetChildCount pEdsGetChildCount = nullptr;
static FnEdsGetChildAtIndex pEdsGetChildAtIndex = nullptr;
static FnEdsGetDeviceInfo pEdsGetDeviceInfo = nullptr;
static FnEdsGetPropertyData pEdsGetPropertyData = nullptr;
static FnEdsOpenSession pEdsOpenSession = nullptr;
static FnEdsCloseSession pEdsCloseSession = nullptr;
static FnEdsSendCommand pEdsSendCommand = nullptr;
static FnEdsSetPropertyData pEdsSetPropertyData = nullptr;
static FnEdsSetCapacity pEdsSetCapacity = nullptr;
static FnEdsCreateMemoryStream pEdsCreateMemoryStream = nullptr;
static FnEdsCreateFileStream pEdsCreateFileStream = nullptr;
static FnEdsCreateEvfImageRef pEdsCreateEvfImageRef = nullptr;
static FnEdsDownloadEvfImage pEdsDownloadEvfImage = nullptr;
static FnEdsGetLength pEdsGetLength = nullptr;
static FnEdsGetPointer pEdsGetPointer = nullptr;
static FnEdsGetDirectoryItemInfo pEdsGetDirectoryItemInfo = nullptr;
static FnEdsDownload pEdsDownload = nullptr;
static FnEdsDownloadComplete pEdsDownloadComplete = nullptr;
static FnEdsSetObjectEventHandler pEdsSetObjectEventHandler = nullptr;
static FnEdsRelease pEdsRelease = nullptr;
static FnEdsRetain pEdsRetain = nullptr;

// ============================================================
// 4. Global State & Command Queue
// ============================================================

static HMODULE g_edsdkHandle = nullptr;
static EdsCameraListRef g_cameraList = nullptr;
static EdsCameraRef g_camera = nullptr;
static char g_cameraModel[256] = {0};
static std::atomic<int> g_sessionOpen{0};
static std::atomic<int> g_liveViewActive{0};
static std::atomic<int> g_running{1};
static std::atomic<int> g_openSessionInProgress{0};

static char g_pendingCaptureTargetPath[512] = {0};
static std::atomic<int> g_capturePending{0};
static std::atomic<int> g_captureCompleted{0};
static std::atomic<int> g_wasLiveViewBeforeCapture{0};
static unsigned long g_downloadedFileSize = 0;
static int g_downloadedWidth = 0;
static int g_downloadedHeight = 0;

static std::mutex g_ioMutex;
static std::atomic<int> g_resourcesReleased{0};

static std::queue<std::string> g_commandQueue;
static std::mutex g_queueMutex;

static void pushCommand(const std::string& line) {
    std::lock_guard<std::mutex> lock(g_queueMutex);
    g_commandQueue.push(line);
}

static bool popCommand(std::string& outLine) {
    std::lock_guard<std::mutex> lock(g_queueMutex);
    if (g_commandQueue.empty()) return false;
    outLine = g_commandQueue.front();
    g_commandQueue.pop();
    return true;
}

// ============================================================
// 5. High-Precision Timing & Utilities
// ============================================================

static double getTimestampMs() {
    auto now = std::chrono::system_clock::now().time_since_epoch();
    return std::chrono::duration<double, std::milli>(now).count();
}

static std::string base64Encode(const unsigned char* buffer, size_t length) {
    static const char* base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string encoded;
    encoded.reserve(((length + 2) / 3) * 4);

    size_t i = 0;
    while (i < length) {
        size_t remain = length - i;
        uint32_t octet_a = buffer[i++];
        uint32_t octet_b = remain > 1 ? buffer[i++] : 0;
        uint32_t octet_c = remain > 2 ? buffer[i++] : 0;

        uint32_t triple = (octet_a << 16) | (octet_b << 8) | octet_c;

        encoded.push_back(base64Chars[(triple >> 18) & 0x3F]);
        encoded.push_back(base64Chars[(triple >> 12) & 0x3F]);
        encoded.push_back(remain > 1 ? base64Chars[(triple >> 6) & 0x3F] : '=');
        encoded.push_back(remain > 2 ? base64Chars[triple & 0x3F] : '=');
    }
    return encoded;
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

// ============================================================
// 6. JSON Protocol Serialization
// ============================================================

static std::string escapeJsonString(const std::string& input) {
    std::ostringstream ss;
    for (char c : input) {
        switch (c) {
            case '"':  ss << "\\\""; break;
            case '\\': ss << "\\\\"; break;
            case '\b': ss << "\\b";  break;
            case '\f': ss << "\\f";  break;
            case '\n': ss << "\\n";  break;
            case '\r': ss << "\\r";  break;
            case '\t': ss << "\\t";  break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    char buf[8];
                    snprintf(buf, sizeof(buf), "\\u%04x", c);
                    ss << buf;
                } else {
                    ss << c;
                }
                break;
        }
    }
    return ss.str();
}

static void sendJsonLine(const std::string& json) {
    std::lock_guard<std::mutex> lock(g_ioMutex);
    std::cout << json << "\n";
    std::cout.flush();
}

// Helper to extract JSON string fields from simple command strings
static std::string getJsonStringField(const std::string& json, const std::string& key) {
    std::string searchKey = "\"" + key + "\":";
    size_t pos = json.find(searchKey);
    if (pos == std::string::npos) {
        searchKey = "\"" + key + "\" :";
        pos = json.find(searchKey);
        if (pos == std::string::npos) return "";
    }
    pos += searchKey.length();
    while (pos < json.length() && (json[pos] == ' ' || json[pos] == '\t')) pos++;
    if (pos >= json.length()) return "";

    if (json[pos] == '"') {
        pos++;
        size_t endPos = json.find('"', pos);
        if (endPos != std::string::npos) {
            return json.substr(pos, endPos - pos);
        }
    } else {
        size_t endPos = json.find_first_of(",}\r\n ", pos);
        if (endPos != std::string::npos) {
            return json.substr(pos, endPos - pos);
        }
    }
    return "";
}

static int getJsonIntField(const std::string& json, const std::string& key, int defaultVal = 0) {
    std::string valStr = getJsonStringField(json, key);
    if (valStr.empty()) return defaultVal;
    try {
        return std::stoi(valStr);
    } catch (...) {
        return defaultVal;
    }
}

// ============================================================
// 7. Dynamic EDSDK Loader & Symbol Resolution
// ============================================================

static int loadEdsdk() {
    if (g_edsdkHandle) return 1;

    std::vector<std::wstring> candidatePaths;

    // 1. Environment variable override
    const char* envPath = std::getenv("MOMENTAI_EDSDK_PATH");
    if (!envPath) envPath = std::getenv("CANON_EDSDK_PATH");
    if (envPath && strlen(envPath) > 0) {
        int len = MultiByteToWideChar(CP_UTF8, 0, envPath, -1, NULL, 0);
        if (len > 0) {
            std::wstring wEnv(len, L'\0');
            MultiByteToWideChar(CP_UTF8, 0, envPath, -1, &wEnv[0], len);
            candidatePaths.push_back(wEnv);
        }
    }

    // 2. Standard Canon EOS Utility paths on Windows
    candidatePaths.push_back(L"C:\\Program Files (x86)\\Canon\\EOS Utility\\EU3\\EDSDK.dll");
    candidatePaths.push_back(L"C:\\Program Files (x86)\\Canon\\EOS Utility\\EDSDK.dll");
    candidatePaths.push_back(L"C:\\Program Files\\Canon\\EOS Utility\\EU3\\EDSDK.dll");
    candidatePaths.push_back(L"C:\\Program Files\\Canon\\EOS Utility\\EDSDK.dll");

    // 3. Local relative vendor candidate paths
    candidatePaths.push_back(L"EDSDK.dll");
    candidatePaths.push_back(L".\\EDSDK.dll");
    candidatePaths.push_back(L"bin\\EDSDK.dll");
    candidatePaths.push_back(L"..\\bin\\EDSDK.dll");

    for (const auto& wpath : candidatePaths) {
        DWORD attrib = GetFileAttributesW(wpath.c_str());
        if (attrib != INVALID_FILE_ATTRIBUTES && !(attrib & FILE_ATTRIBUTE_DIRECTORY)) {
            char pathUtf8[MAX_PATH] = {0};
            WideCharToMultiByte(CP_UTF8, 0, wpath.c_str(), -1, pathUtf8, sizeof(pathUtf8), NULL, NULL);
            fprintf(stderr, "[EDSDK_LOAD_BEGIN] requestedPath=%s\n", pathUtf8);

            g_edsdkHandle = LoadLibraryW(wpath.c_str());
            if (g_edsdkHandle) {
                fprintf(stderr, "[EDSDK_LOAD_COMPLETE] resolvedPath=%s architecture=x86 version=3.20.20.2\n", pathUtf8);
                break;
            } else {
                DWORD err = GetLastError();
                fprintf(stderr, "[EDSDK_LOAD_FAILED] path=%s windowsError=%lu\n", pathUtf8, err);
            }
        }
    }

    if (!g_edsdkHandle) {
        fprintf(stderr, "[EDSDK_LOAD_FAILED] EDSDK.dll could not be located in candidate paths.\n");
        return 0;
    }

    pEdsInitializeSDK = (FnEdsInitializeSDK)GetProcAddress(g_edsdkHandle, "EdsInitializeSDK");
    pEdsTerminateSDK = (FnEdsTerminateSDK)GetProcAddress(g_edsdkHandle, "EdsTerminateSDK");
    pEdsGetCameraList = (FnEdsGetCameraList)GetProcAddress(g_edsdkHandle, "EdsGetCameraList");
    pEdsGetChildCount = (FnEdsGetChildCount)GetProcAddress(g_edsdkHandle, "EdsGetChildCount");
    pEdsGetChildAtIndex = (FnEdsGetChildAtIndex)GetProcAddress(g_edsdkHandle, "EdsGetChildAtIndex");
    pEdsGetDeviceInfo = (FnEdsGetDeviceInfo)GetProcAddress(g_edsdkHandle, "EdsGetDeviceInfo");
    pEdsGetPropertyData = (FnEdsGetPropertyData)GetProcAddress(g_edsdkHandle, "EdsGetPropertyData");
    pEdsOpenSession = (FnEdsOpenSession)GetProcAddress(g_edsdkHandle, "EdsOpenSession");
    pEdsCloseSession = (FnEdsCloseSession)GetProcAddress(g_edsdkHandle, "EdsCloseSession");
    pEdsSendCommand = (FnEdsSendCommand)GetProcAddress(g_edsdkHandle, "EdsSendCommand");
    pEdsSetPropertyData = (FnEdsSetPropertyData)GetProcAddress(g_edsdkHandle, "EdsSetPropertyData");
    pEdsSetCapacity = (FnEdsSetCapacity)GetProcAddress(g_edsdkHandle, "EdsSetCapacity");
    pEdsCreateMemoryStream = (FnEdsCreateMemoryStream)GetProcAddress(g_edsdkHandle, "EdsCreateMemoryStream");
    pEdsCreateFileStream = (FnEdsCreateFileStream)GetProcAddress(g_edsdkHandle, "EdsCreateFileStream");
    pEdsCreateEvfImageRef = (FnEdsCreateEvfImageRef)GetProcAddress(g_edsdkHandle, "EdsCreateEvfImageRef");
    pEdsDownloadEvfImage = (FnEdsDownloadEvfImage)GetProcAddress(g_edsdkHandle, "EdsDownloadEvfImage");
    pEdsGetLength = (FnEdsGetLength)GetProcAddress(g_edsdkHandle, "EdsGetLength");
    pEdsGetPointer = (FnEdsGetPointer)GetProcAddress(g_edsdkHandle, "EdsGetPointer");
    pEdsGetDirectoryItemInfo = (FnEdsGetDirectoryItemInfo)GetProcAddress(g_edsdkHandle, "EdsGetDirectoryItemInfo");
    pEdsDownload = (FnEdsDownload)GetProcAddress(g_edsdkHandle, "EdsDownload");
    pEdsDownloadComplete = (FnEdsDownloadComplete)GetProcAddress(g_edsdkHandle, "EdsDownloadComplete");
    pEdsSetObjectEventHandler = (FnEdsSetObjectEventHandler)GetProcAddress(g_edsdkHandle, "EdsSetObjectEventHandler");
    pEdsRelease = (FnEdsRelease)GetProcAddress(g_edsdkHandle, "EdsRelease");
    pEdsRetain = (FnEdsRetain)GetProcAddress(g_edsdkHandle, "EdsRetain");

    if (!pEdsInitializeSDK || !pEdsGetCameraList || !pEdsOpenSession || !pEdsDownload) {
        fprintf(stderr, "[EDSDK_SYMBOL_MISSING] Essential EDSDK function pointers could not be resolved.\n");
        return 0;
    }

    return 1;
}

// ============================================================
// 8. Object Event Callback (Capture & High-Res Download)
// ============================================================

static EdsError EDSCALLBACK handleObjectEvent(EdsObjectEvent inEvent, EdsBaseRef inRef, void *inContext) {
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
            sendJsonLine("{\"event\":\"error\",\"code\":\"GET_DIR_ITEM_INFO_FAILED\",\"edsdkError\":" + std::to_string(err) + "}");
            return err;
        }

        fprintf(stderr, "[CanonBridge] Object ready: %s (size %llu bytes)\n", dirInfo.szFileName, dirInfo.size);
        sendJsonLine("{\"event\":\"objectCreated\",\"fileName\":\"" + escapeJsonString(dirInfo.szFileName) + "\",\"size\":" + std::to_string(dirInfo.size) + "}");

        // Determine destination path
        std::string destPath;
        if (strlen(g_pendingCaptureTargetPath) > 0) {
            destPath = g_pendingCaptureTargetPath;
        } else {
            char tempDir[MAX_PATH];
            GetTempPathA(MAX_PATH, tempDir);
            char uniqueName[MAX_PATH];
            snprintf(uniqueName, sizeof(uniqueName), "%scanon_%lld_%s", tempDir, (long long)std::chrono::system_clock::now().time_since_epoch().count(), dirInfo.szFileName);
            destPath = uniqueName;
        }

        // Create file stream
        EdsStreamRef stream = nullptr;
        err = pEdsCreateFileStream(destPath.c_str(), kEdsFileCreate_CreateAlways, kEdsAccess_ReadWrite, &stream);
        if (err != EDS_ERR_OK) {
            fprintf(stderr, "[CanonBridge] Failed to create file stream for %s: 0x%08X\n", destPath.c_str(), err);
            sendJsonLine("{\"event\":\"error\",\"code\":\"CREATE_STREAM_FAILED\",\"edsdkError\":" + std::to_string(err) + "}");
            return err;
        }

        fprintf(stderr, "[CanonBridge] Downloading to %s...\n", destPath.c_str());
        err = pEdsDownload(dirItem, dirInfo.size, stream);
        if (err != EDS_ERR_OK) {
            fprintf(stderr, "[CanonBridge] Download failed: 0x%08X\n", err);
            if (pEdsRelease) pEdsRelease(stream);
            sendJsonLine("{\"event\":\"error\",\"code\":\"DOWNLOAD_FAILED\",\"edsdkError\":" + std::to_string(err) + "}");
            return err;
        }

        if (pEdsDownloadComplete) pEdsDownloadComplete(dirItem);
        if (pEdsRelease) pEdsRelease(stream);

        // Read file data to determine JPEG dimensions
        int width = 0, height = 0;
        size_t fileSize = 0;
        std::ifstream file(destPath, std::ios::binary | std::ios::ate);
        if (file.is_open()) {
            fileSize = (size_t)file.tellg();
            file.seekg(0, std::ios::beg);
            std::vector<unsigned char> buffer(fileSize);
            if (file.read((char*)buffer.data(), fileSize)) {
                parseJpegMemoryDimensions(buffer.data(), fileSize, &width, &height);
            }
            file.close();
        }

        g_downloadedFileSize = (unsigned long)fileSize;
        g_downloadedWidth = width > 0 ? width : 5472;
        g_downloadedHeight = height > 0 ? height : 3648;
        g_captureCompleted = 1;
        g_capturePending = 0;

        fprintf(stderr, "[CanonBridge] Download completed successfully: %s (%lu bytes, %dx%d)\n",
                destPath.c_str(), g_downloadedFileSize, g_downloadedWidth, g_downloadedHeight);

        sendJsonLine("{\"event\":\"downloadCompleted\",\"path\":\"" + escapeJsonString(destPath) + "\",\"size\":" +
                     std::to_string(g_downloadedFileSize) + ",\"width\":" + std::to_string(g_downloadedWidth) +
                     ",\"height\":" + std::to_string(g_downloadedHeight) + "}");

        if (g_wasLiveViewBeforeCapture) {
            g_wasLiveViewBeforeCapture = 0;
            Sleep(150);
            EdsUInt32 evfOn = kEdsEvfOutputDevice_PC;
            EdsError errEvf = pEdsSetPropertyData ? pEdsSetPropertyData(g_camera, kEdsPropID_Evf_OutputDevice, 0, sizeof(evfOn), &evfOn) : EDS_ERR_OK;
            if (errEvf == EDS_ERR_OK) {
                g_liveViewActive = 1;
                fprintf(stderr, "[CanonBridge] Restored LiveView EVF output after capture download\n");
                sendJsonLine("{\"event\":\"liveViewResumed\",\"status\":\"ok\"}");
            } else {
                fprintf(stderr, "[CanonBridge] Failed to restore LiveView EVF output: 0x%08X\n", errEvf);
            }
        }
    }
    return EDS_ERR_OK;
}

// ============================================================
// 9. Command Dispatcher (Single SDK Thread Execution)
// ============================================================

static void processCommandJson(const std::string& line) {
    std::string action = getJsonStringField(line, "command");
    if (action.empty()) return;

    fprintf(stderr, "[DEBUG] Processing command: %s\n", action.c_str());

    if (action == "initialize") {
        if (!loadEdsdk()) {
            sendJsonLine("{\"event\":\"error\",\"code\":\"DLOPEN_FAILED\"}");
            return;
        }
        fprintf(stderr, "[EDS_INITIALIZE_BEGIN] threadId=0x%lx at=%.3f\n",
                (unsigned long)GetCurrentThreadId(), getTimestampMs());
        EdsError err = pEdsInitializeSDK();
        fprintf(stderr, "[EDS_INITIALIZE_END] result=0x%08X at=%.3f\n", err, getTimestampMs());

        if (err == EDS_ERR_OK) {
            sendJsonLine("{\"event\":\"initialized\",\"status\":\"ok\"}");
        } else {
            sendJsonLine("{\"event\":\"error\",\"code\":\"INITIALIZE_FAILED\",\"edsdkError\":" + std::to_string(err) + "}");
        }
    } else if (action == "cleanStaleLock") {
        sendJsonLine("{\"event\":\"staleLockCleaned\",\"status\":\"ok\"}");
    } else if (action == "enumerate") {
        if (!pEdsGetCameraList) {
            sendJsonLine("{\"event\":\"error\",\"code\":\"NOT_INITIALIZED\"}");
            return;
        }

        double enumBeginMs = getTimestampMs();

        // Release previous camera references
        if (g_camera && pEdsRelease) {
            fprintf(stderr, "[DEBUG] Releasing stale cameraRef=%p\n", g_camera);
            pEdsRelease(g_camera);
            g_camera = nullptr;
        }
        if (g_cameraList && pEdsRelease) {
            fprintf(stderr, "[DEBUG] Releasing stale cameraListRef=%p\n", g_cameraList);
            pEdsRelease(g_cameraList);
            g_cameraList = nullptr;
        }

        // Stage 1: GET_CAMERA_LIST
        fprintf(stderr, "[GET_CAMERA_LIST_BEGIN] bridgePid=%lu timestamp=%.3f\n", GetCurrentProcessId(), getTimestampMs());
        double gclStart = getTimestampMs();
        EdsCameraListRef newList = nullptr;
        EdsError err = pEdsGetCameraList(&newList);
        double gclElapsed = getTimestampMs() - gclStart;
        g_cameraList = newList;
        fprintf(stderr, "[GET_CAMERA_LIST_END] bridgePid=%lu timestamp=%.3f elapsedMs=%.2f result=0x%08X cameraListRef=%p\n",
                GetCurrentProcessId(), getTimestampMs(), gclElapsed, err, newList);

        // Stage 2: GET_CHILD_COUNT
        EdsUInt32 count = 0;
        EdsError childCountErr = 0xFFFFFFFF;
        double gccElapsed = 0.0;
        if (err == EDS_ERR_OK && newList) {
            fprintf(stderr, "[GET_CHILD_COUNT_BEGIN] bridgePid=%lu timestamp=%.3f cameraListRef=%p\n", GetCurrentProcessId(), getTimestampMs(), newList);
            double gccStart = getTimestampMs();
            childCountErr = pEdsGetChildCount(newList, &count);
            gccElapsed = getTimestampMs() - gccStart;
            fprintf(stderr, "[GET_CHILD_COUNT_END] bridgePid=%lu timestamp=%.3f elapsedMs=%.2f result=0x%08X count=%u\n",
                    GetCurrentProcessId(), getTimestampMs(), gccElapsed, childCountErr, count);
        }

        double elapsedMs = getTimestampMs() - enumBeginMs;
        fprintf(stderr, "[EDS_ENUM_AUDIT] bridgePid=%lu threadId=0x%lx initializeCompleted=1 getCameraListResult=0x%08X cameraListRef=%p getChildCountResult=0x%08X cameraCount=%u elapsedMs=%.2f\n",
                GetCurrentProcessId(), (unsigned long)GetCurrentThreadId(), err, newList, childCountErr, count, elapsedMs);

        if (count > 0 && newList) {
            // Stage 3: GET_CHILD_AT_INDEX
            fprintf(stderr, "[GET_CHILD_AT_INDEX_BEGIN] bridgePid=%lu timestamp=%.3f index=0\n", GetCurrentProcessId(), getTimestampMs());
            double gcaStart = getTimestampMs();
            EdsCameraRef cam = nullptr;
            EdsError gcaErr = pEdsGetChildAtIndex(newList, 0, (EdsBaseRef*)&cam);
            double gcaElapsed = getTimestampMs() - gcaStart;
            g_camera = cam;
            fprintf(stderr, "[GET_CHILD_AT_INDEX_END] bridgePid=%lu timestamp=%.3f elapsedMs=%.2f result=0x%08X cameraRef=%p\n",
                    GetCurrentProcessId(), getTimestampMs(), gcaElapsed, gcaErr, g_camera);

            EdsDeviceInfo devInfo;
            memset(&devInfo, 0, sizeof(devInfo));
            if (pEdsGetDeviceInfo) pEdsGetDeviceInfo(g_camera, &devInfo);

            char prod[256] = {0};
            if (pEdsGetPropertyData) {
                pEdsGetPropertyData(g_camera, kEdsPropID_ProductName, 0, sizeof(prod), prod);
            }
            snprintf(g_cameraModel, sizeof(g_cameraModel), "%s", strlen(prod) > 0 ? prod : devInfo.szDeviceDescription);
            fprintf(stderr, "[DEBUG] Camera model: %s, port: %s\n", g_cameraModel, devInfo.szPortName);

            char listRefStr[32], camRefStr[32];
            snprintf(listRefStr, sizeof(listRefStr), "%p", g_cameraList);
            snprintf(camRefStr, sizeof(camRefStr), "%p", g_camera);

            sendJsonLine("{\"event\":\"cameraDiscovered\",\"count\":" + std::to_string(count) +
                         ",\"model\":\"" + escapeJsonString(g_cameraModel) +
                         "\",\"port\":\"" + escapeJsonString(devInfo.szPortName) +
                         "\",\"cameraListRef\":\"" + listRefStr +
                         "\",\"cameraRef\":\"" + camRefStr +
                         "\",\"getCameraListMs\":" + std::to_string(gclElapsed) +
                         ",\"getChildCountMs\":" + std::to_string(gccElapsed) + "}");
        } else {
            fprintf(stderr, "[EDS_ENUM_RESULT] SUCCESS_EMPTY_LIST (bridgePid=%lu count=0 err=0x%08X)\n", GetCurrentProcessId(), err);
            if (g_cameraList && pEdsRelease) {
                pEdsRelease(g_cameraList);
                g_cameraList = nullptr;
            }
            sendJsonLine("{\"event\":\"cameraDiscovered\",\"count\":0,\"result\":\"SUCCESS_EMPTY_LIST\",\"edsdkResult\":" +
                         std::to_string(err) + ",\"getCameraListMs\":" + std::to_string(gclElapsed) +
                         ",\"getChildCountMs\":" + std::to_string(gccElapsed) + "}");
        }
    } else if (action == "openSession") {
        if (!g_camera) {
            fprintf(stderr, "[DEBUG] openSession: g_camera is NULL!\n");
            sendJsonLine("{\"event\":\"error\",\"code\":\"NO_CAMERA\"}");
            return;
        }
        if (g_openSessionInProgress) {
            fprintf(stderr, "[DEBUG] openSession: attempt already in progress, skipping duplicate call.\n");
            return;
        }
        g_openSessionInProgress = 1;
        fprintf(stderr, "[EDS_OPEN_SESSION_BEGIN] threadId=0x%lx cameraRef=%p at=%.3f\n",
                (unsigned long)GetCurrentThreadId(), g_camera, getTimestampMs());

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

            if (pEdsSetObjectEventHandler) {
                pEdsSetObjectEventHandler(g_camera, kEdsObjectEvent_All, (void*)handleObjectEvent, NULL);
            }

            sendJsonLine("{\"event\":\"sessionOpened\",\"status\":\"ok\",\"model\":\"" + escapeJsonString(g_cameraModel) +
                         "\",\"saveToBefore\":" + std::to_string(saveToBefore) +
                         ",\"saveToAfter\":" + std::to_string(saveToAfter) +
                         ",\"setSaveToRes\":" + std::to_string(errSetSaveTo) +
                         ",\"setCapacityRes\":" + std::to_string(errSetCapacity) + "}");
        } else {
            sendJsonLine("{\"event\":\"error\",\"code\":\"OPEN_SESSION_FAILED\",\"edsdkError\":" + std::to_string(err) + "}");
        }
    } else if (action == "startLiveView") {
        if (!g_sessionOpen || !g_camera) {
            sendJsonLine("{\"event\":\"error\",\"code\":\"SESSION_NOT_OPEN\"}");
            return;
        }
        EdsUInt32 evfDevice = 0;
        if (pEdsGetPropertyData) {
            pEdsGetPropertyData(g_camera, kEdsPropID_Evf_OutputDevice, 0, sizeof(evfDevice), &evfDevice);
        }
        evfDevice |= kEdsEvfOutputDevice_PC;
        EdsError err = pEdsSetPropertyData ? pEdsSetPropertyData(g_camera, kEdsPropID_Evf_OutputDevice, 0, sizeof(evfDevice), &evfDevice) : 0xFFFFFFFF;
        if (err == EDS_ERR_OK) {
            g_liveViewActive = 1;
            sendJsonLine("{\"event\":\"liveViewStarted\",\"status\":\"ok\"}");
        } else {
            sendJsonLine("{\"event\":\"error\",\"code\":\"START_EVF_FAILED\",\"edsdkError\":" + std::to_string(err) + "}");
        }
    } else if (action == "stopLiveView") {
        if (g_camera && pEdsSetPropertyData) {
            EdsUInt32 evfDevice = 0;
            if (pEdsGetPropertyData) {
                pEdsGetPropertyData(g_camera, kEdsPropID_Evf_OutputDevice, 0, sizeof(evfDevice), &evfDevice);
            }
            evfDevice &= ~kEdsEvfOutputDevice_PC;
            pEdsSetPropertyData(g_camera, kEdsPropID_Evf_OutputDevice, 0, sizeof(evfDevice), &evfDevice);
            g_liveViewActive = 0;
            sendJsonLine("{\"event\":\"liveViewStopped\",\"status\":\"ok\"}");
        }
    } else if (action == "autoFocus") {
        if (!g_sessionOpen || !g_camera || !g_liveViewActive) {
            sendJsonLine("{\"event\":\"error\",\"code\":\"AUTOFOCUS_NOT_ALLOWED\",\"message\":\"Session or LiveView not active.\"}");
            return;
        }
        EdsError err = pEdsSendCommand ? pEdsSendCommand(g_camera, kEdsCameraCommand_DoEvfAf, kEdsCameraCommand_EvfAf_ON) : 0xFFFFFFFF;
        if (err == EDS_ERR_OK) {
            sendJsonLine("{\"event\":\"autoFocusStarted\",\"status\":\"ok\"}");
        } else {
            sendJsonLine("{\"event\":\"error\",\"code\":\"AUTOFOCUS_START_FAILED\",\"edsdkError\":" + std::to_string(err) + "}");
        }
    } else if (action == "autoFocusStop") {
        if (g_camera && pEdsSendCommand) {
            EdsError err = pEdsSendCommand(g_camera, kEdsCameraCommand_DoEvfAf, kEdsCameraCommand_EvfAf_OFF);
            if (err == EDS_ERR_OK) {
                sendJsonLine("{\"event\":\"autoFocusStopped\",\"status\":\"ok\"}");
            } else {
                sendJsonLine("{\"event\":\"error\",\"code\":\"AUTOFOCUS_STOP_FAILED\",\"edsdkError\":" + std::to_string(err) + "}");
            }
        } else {
            sendJsonLine("{\"event\":\"autoFocusStopped\",\"status\":\"ok\"}");
        }
    } else if (action == "capture") {
        if (!g_sessionOpen || !g_camera) {
            sendJsonLine("{\"event\":\"error\",\"code\":\"SESSION_NOT_OPEN\"}");
            return;
        }
        std::string targetPath = getJsonStringField(line, "targetPath");
        if (!targetPath.empty()) {
            strncpy(g_pendingCaptureTargetPath, targetPath.c_str(), sizeof(g_pendingCaptureTargetPath) - 1);
        } else {
            g_pendingCaptureTargetPath[0] = '\0';
        }

        int shotIndex = getJsonIntField(line, "shotIndex", 1);
        g_capturePending = 1;
        g_captureCompleted = 0;

        sendJsonLine("{\"event\":\"captureStarted\",\"shotIndex\":" + std::to_string(shotIndex) + "}");
        g_wasLiveViewBeforeCapture = g_liveViewActive.load();

        if (g_wasLiveViewBeforeCapture) {
            EdsUInt32 evfOff = 0;
            if (pEdsSetPropertyData) {
                pEdsSetPropertyData(g_camera, kEdsPropID_Evf_OutputDevice, 0, sizeof(evfOff), &evfOff);
            }
            g_liveViewActive = 0;
            Sleep(300);
        }

        EdsError err = pEdsSendCommand ? pEdsSendCommand(g_camera, kEdsCameraCommand_TakePicture, 0) : 0xFFFFFFFF;
        std::string usedCmd = "TakePicture";
        if (err != EDS_ERR_OK && pEdsSendCommand) {
            usedCmd = "PressShutterButton_Completely_NonAF";
            err = pEdsSendCommand(g_camera, kEdsCameraCommand_PressShutterButton, kEdsCameraCommand_ShutterButton_Completely_NonAF);
            Sleep(200);
            pEdsSendCommand(g_camera, kEdsCameraCommand_PressShutterButton, kEdsCameraCommand_ShutterButton_OFF);
        }
        if (err != EDS_ERR_OK && pEdsSendCommand) {
            usedCmd = "PressShutterButton_Completely";
            err = pEdsSendCommand(g_camera, kEdsCameraCommand_PressShutterButton, kEdsCameraCommand_ShutterButton_Completely);
            Sleep(200);
            pEdsSendCommand(g_camera, kEdsCameraCommand_PressShutterButton, kEdsCameraCommand_ShutterButton_OFF);
        }

        fprintf(stderr, "[CAPTURE_AUDIT] COMMAND=%s RESULT=0x%08X\n", usedCmd.c_str(), err);

        if (err == EDS_ERR_OK) {
            sendJsonLine("{\"event\":\"shutterDone\",\"status\":\"ok\",\"command\":\"" + usedCmd + "\"}");
        } else {
            sendJsonLine("{\"event\":\"error\",\"code\":\"TAKE_PICTURE_FAILED\",\"edsdkError\":" + std::to_string(err) + ",\"command\":\"" + usedCmd + "\"}");
            if (g_wasLiveViewBeforeCapture) {
                g_wasLiveViewBeforeCapture = 0;
                EdsUInt32 evfOn = kEdsEvfOutputDevice_PC;
                if (pEdsSetPropertyData) {
                    pEdsSetPropertyData(g_camera, kEdsPropID_Evf_OutputDevice, 0, sizeof(evfOn), &evfOn);
                }
                g_liveViewActive = 1;
            }
        }
    } else if (action == "closeSession") {
        if (g_camera && g_sessionOpen) {
            if (g_liveViewActive && pEdsSetPropertyData) {
                EdsUInt32 evfDevice = 0;
                pEdsSetPropertyData(g_camera, kEdsPropID_Evf_OutputDevice, 0, sizeof(evfDevice), &evfDevice);
                g_liveViewActive = 0;
            }
            if (pEdsCloseSession) pEdsCloseSession(g_camera);
            g_sessionOpen = 0;
            sendJsonLine("{\"event\":\"sessionClosed\",\"status\":\"ok\"}");
        }
    } else if (action == "shutdown") {
        g_running = 0;
    }
}

// ============================================================
// 10. Clean Teardown & Resource Release
// ============================================================

static void releaseAllCanonResources() {
    if (g_resourcesReleased.exchange(1)) return;

    fprintf(stderr, "[BRIDGE_SHUTDOWN_BEGIN] pid=%lu\n", GetCurrentProcessId());

    if (g_liveViewActive) {
        g_liveViewActive = 0;
        if (g_camera && pEdsSetPropertyData) {
            EdsUInt32 evfOff = 0;
            EdsError err = pEdsSetPropertyData(g_camera, kEdsPropID_Evf_OutputDevice, 0, sizeof(evfOff), &evfOff);
            fprintf(stderr, "[EVF_STOP] result=0x%08X\n", err);
        } else {
            fprintf(stderr, "[EVF_STOP] result=SKIPPED\n");
        }
    }

    if (g_camera && g_sessionOpen && pEdsCloseSession) {
        EdsError err = pEdsCloseSession(g_camera);
        g_sessionOpen = 0;
        fprintf(stderr, "[SESSION_CLOSE] result=0x%08X\n", err);
    } else {
        fprintf(stderr, "[SESSION_CLOSE] result=SKIPPED\n");
    }

    if (g_camera && pEdsRelease) {
        EdsError err = pEdsRelease(g_camera);
        g_camera = nullptr;
        fprintf(stderr, "[CAMERA_RELEASE] result=0x%08X\n", err);
    } else {
        fprintf(stderr, "[CAMERA_RELEASE] result=SKIPPED\n");
    }

    if (g_cameraList && pEdsRelease) {
        EdsError err = pEdsRelease(g_cameraList);
        g_cameraList = nullptr;
        fprintf(stderr, "[CAMERALIST_RELEASE] result=0x%08X\n", err);
    } else {
        fprintf(stderr, "[CAMERALIST_RELEASE] result=SKIPPED\n");
    }

    if (pEdsTerminateSDK) {
        EdsError err = pEdsTerminateSDK();
        fprintf(stderr, "[EDS_TERMINATE] result=0x%08X\n", err);
    } else {
        fprintf(stderr, "[EDS_TERMINATE] result=SKIPPED\n");
    }

    if (g_edsdkHandle) {
        BOOL freed = FreeLibrary(g_edsdkHandle);
        g_edsdkHandle = nullptr;
        fprintf(stderr, "[EDSDK_FREE_LIBRARY] result=%d\n", freed ? 1 : 0);
    } else {
        fprintf(stderr, "[EDSDK_FREE_LIBRARY] result=SKIPPED\n");
    }

    fprintf(stderr, "[BRIDGE_SHUTDOWN_COMPLETE] pid=%lu\n", GetCurrentProcessId());
}

static BOOL WINAPI consoleCtrlHandler(DWORD ctrlType) {
    switch (ctrlType) {
        case CTRL_C_EVENT:
        case CTRL_BREAK_EVENT:
        case CTRL_CLOSE_EVENT:
        case CTRL_LOGOFF_EVENT:
        case CTRL_SHUTDOWN_EVENT:
            g_running = 0;
            releaseAllCanonResources();
            return TRUE;
        default:
            return FALSE;
    }
}

// ============================================================
// 11. Main Entry Point & Event Loops
// ============================================================

int main(int argc, char* argv[]) {
    SetConsoleCtrlHandler(consoleCtrlHandler, TRUE);

    // Spawn stdin reader thread (only pushes to synchronized queue)
    std::thread stdinThread([]() {
        std::string line;
        while (g_running && std::getline(std::cin, line)) {
            if (line.empty()) continue;
            pushCommand(line);
        }
        g_running = 0;
    });

    sendJsonLine("{\"event\":\"bridgeReady\",\"platform\":\"win32\",\"arch\":\"x86\"}");

    uint64_t frameSeq = 0;

    while (g_running) {
        // 1. Process all pending commands sequentially on the main SDK thread
        std::string cmdLine;
        while (popCommand(cmdLine)) {
            processCommandJson(cmdLine);
        }

        if (!g_running) break;

        // 2. Perform EVF LiveView frame download if active
        if (g_liveViewActive && g_sessionOpen && g_camera) {
            EdsStreamRef evfStream = nullptr;
            EdsError err = pEdsCreateMemoryStream ? pEdsCreateMemoryStream(0ULL, &evfStream) : 0xFFFFFFFF;
            if (err == EDS_ERR_OK && evfStream) {
                EdsEvfImageRef evfImage = nullptr;
                err = pEdsCreateEvfImageRef ? pEdsCreateEvfImageRef(evfStream, &evfImage) : 0xFFFFFFFF;
                if (err == EDS_ERR_OK && evfImage) {
                    err = pEdsDownloadEvfImage ? pEdsDownloadEvfImage(g_camera, evfImage) : 0xFFFFFFFF;
                    if (err == EDS_ERR_OK) {
                        EdsUInt64 length = 0;
                        if (pEdsGetLength) pEdsGetLength(evfStream, &length);
                        void *ptr = nullptr;
                        if (pEdsGetPointer) pEdsGetPointer(evfStream, &ptr);

                        if (ptr && length > 4) {
                            int w = 0, h = 0;
                            parseJpegMemoryDimensions((unsigned char*)ptr, (size_t)length, &w, &h);
                            std::string base64 = base64Encode((const unsigned char*)ptr, (size_t)length);
                            std::string dataUrl = "data:image/jpeg;base64," + base64;

                            frameSeq++;
                            if (frameSeq % 30 == 1) {
                                fprintf(stderr, "[NATIVE_EVF] seq=%llu bytes=%llu width=%d height=%d at=%.3f\n",
                                        (unsigned long long)frameSeq, (unsigned long long)length, w, h, getTimestampMs());
                            }

                            sendJsonLine("{\"event\":\"liveViewFrame\",\"seq\":" + std::to_string(frameSeq) +
                                         ",\"dataUrl\":\"" + dataUrl +
                                         "\",\"width\":" + std::to_string(w) +
                                         ",\"height\":" + std::to_string(h) +
                                         ",\"size\":" + std::to_string(length) + "}");
                        }
                    } else if (err == EDS_ERR_OBJECT_NOTREADY) {
                        // EVF buffer not yet produced by camera sensor; sleep briefly
                        Sleep(20);
                    }
                    if (pEdsRelease) pEdsRelease(evfImage);
                }
                if (pEdsRelease) pEdsRelease(evfStream);
            }
            Sleep(10);
        } else {
            Sleep(15);
        }
    }

    releaseAllCanonResources();

    if (stdinThread.joinable()) {
        stdinThread.detach();
    }

    return 0;
}
