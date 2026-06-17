using System;
using System.Text;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;

namespace Shadowhorse.Pearl
{
    [Serializable]
    public class PearlUnityContext
    {
        public string projectName;
        public string sceneName;
        public string[] selectedObjects;
        public string mode = "ask";
        public bool playMode;
    }

    [Serializable]
    public class PearlUnityRequest
    {
        public string text;
        public string kind = "general";
        public string persona = "pearl";
        public string provider = "auto";
        public PearlUnityContext unityContext;
    }

    public static class PearlBridgeClient
    {
        public static async Task<string> AskPearlAsync(string bridgeUrl, PearlUnityRequest request)
        {
            if (string.IsNullOrWhiteSpace(bridgeUrl))
            {
                throw new ArgumentException("bridgeUrl is required");
            }

            if (request == null || string.IsNullOrWhiteSpace(request.text))
            {
                throw new ArgumentException("Request text is required");
            }

            var url = bridgeUrl.TrimEnd('/') + "/v1/unity/ask";
            var json = JsonUtility.ToJson(request);
            var payload = Encoding.UTF8.GetBytes(json);

            using var uwr = new UnityWebRequest(url, UnityWebRequest.kHttpVerbPOST)
            {
                uploadHandler = new UploadHandlerRaw(payload),
                downloadHandler = new DownloadHandlerBuffer()
            };

            uwr.SetRequestHeader("Content-Type", "application/json");

            var operation = uwr.SendWebRequest();
            while (!operation.isDone)
            {
                await Task.Yield();
            }

            if (uwr.result != UnityWebRequest.Result.Success)
            {
                throw new InvalidOperationException($"Pearl bridge request failed: {uwr.error}");
            }

            return uwr.downloadHandler.text;
        }
    }
}
