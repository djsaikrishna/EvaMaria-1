// ==UserScript==
// @name         Video Downloader for Tampermonkey
// @version      0.4
// @description  Will add a download button to Reddit, Facebook and Youtube videos
// @author       Github/Mordo95
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @run-at document-start
// ==/UserScript==

// version 0.4 fixes reddit thumbnails also receiving a button

(function() {
    'use strict';

    class Mordo95DL {
        static addStyle(css) {
            const style = document.getElementById("GM_addStyleBy8626") || (function() {
                const style = document.createElement('style');
                style.type = 'text/css';
                style.id = "GM_addStyleBy8626";
                document.head.appendChild(style);
                return style;
            })();
            const sheet = style.sheet;
            sheet.insertRule(css, (sheet.rules || sheet.cssRules || []).length);
        }

        static paramsToObject(entries) {
            const result = {}
            for(const [key, value] of entries) { // each 'entry' is a [key, value] tupple
                result[key] = value;
            }
            return result;
        }

        static buildParams(p) {
            return new URLSearchParams(p).toString();
        }
    }

    class FBDL {
        getReactFiber(el) {
            for (let prop of Object.keys(el)) {
                if (prop.startsWith("__reactFiber")) {
                    return el[prop];
                }
            }
            return null;
        }

        fiberReturnUntil(fiber, displayName) {
            let fiberInst = fiber;
            while (fiberInst != null) {
                let fiberInstName = "";
                if (typeof fiberInst.elementType === "string")
                    fiberInstName = fiberInst.elementType;
                else if (typeof fiberInst.elementType === "function")
                    fiberInstName = fiberInst.elementType.displayName;
                if (fiberInstName === displayName)
                    return fiberInst;

                fiberInst = fiberInst.return;
            }
            return null;
        }

        parentsUntil(el, c) {
            let elInst = el;
            while (elInst != null) {
                if (elInst.classList.toString() === c)
                    return elInst;
                elInst = elInst.parentElement;
            }
            return null;
        }

        getVideoImplementation(fiber, impl = "VideoPlayerProgressiveImplementation") {
            if(!fiber || !fiber.memoizedProps || !fiber.memoizedProps.implementations)
                return null;
            return fiber.memoizedProps.implementations.find(x => x.typename === impl);
        }

        addVideoButton(on, videoEl) {
            let btn = document.createElement("div");
            btn.innerHTML = "Download (HD)";
            btn.classList.add("dlBtn");
            btn.onclick = () => this.btnAct(videoEl);
            //let parent = parentsUntil(videoEl, videoEl.classList[0]) || videoEl.parentElement;
            on.prepend(btn);
        }

        btnAct(videoEl) {
            let fiber = this.getReactFiber(videoEl);
            let props = this.fiberReturnUntil(fiber, "a [from CoreVideoPlayer.react]");
            let impl = this.getVideoImplementation(props);
            if (impl.data.hdSrc) {
                window.open(impl.data.hdSrc);
            } else {
                window.open(impl.data.sdSrc);
            }
        }

        inject() {
            setInterval(() => {
                let videos = document.querySelectorAll("video:not([data-tagged])");
                for (let video of videos) {
                    video.setAttribute("data-tagged", "true");
                    let fiber = this.getReactFiber(video.parentElement);
                    let props = this.fiberReturnUntil(fiber, "a [from CoreVideoPlayer.react]");
                    this.addVideoButton(document.querySelector(`[data-instancekey='${props.memoizedState.memoizedState}']`), video.parentElement);
                }
            }, 200);
            Mordo95DL.addStyle(".dlBtn{position:absolute;top:0;right:0;z-index:99999;padding:10px 15px;margin:5px;cursor:pointer;outline:0;background:var(--primary-button-background);color:var(--primary-button-text);border:1px solid 1px solid var(--accent);font-family: var(--font-family-segoe)!important}");
            Mordo95DL.addStyle(".dlBtn:hover{background-color:var(--primary-button-pressed)}");
        }
    }

    class YTDL {
        addVideoButton(on) {
            let btn = document.createElement("div");
            btn.innerHTML = this.btnText;
            btn.classList.add("dlBtn");
            btn.onclick = () => this.getLinks(btn);
            on.prepend(btn);
        }

        getLinks(btn) {
            let fd = new FormData();
            fd.set("q", window.location.href);
            fd.set("vt", "mp4");
            let url = "https://yt1s.com/api/ajaxSearch/index";
            GM_xmlhttpRequest({
                method: 'POST',
                url,
                data: fd,
                onload: (resp) => {
                    let js = JSON.parse(resp.responseText);
                    this.convert(btn, js.vid, js.links.mp4.auto.k);
                }
            });
        }

        convert(btn, vid, k) {
            let fd = new FormData();
            fd.set("vid", vid);
            fd.set("k", k);
            btn.innerHTML = "Converting ...";
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://yt1s.com/api/ajaxConvert/convert',
                data: fd,
                timeout: 60000,
                onload: (resp) => {
                    let js = JSON.parse(resp.responseText);
                    let status = js.c_status;
                    if (status === "CONVERTED") {
                        window.open(js.dlink);
                    } else {
                        alert("Error converting video. Please try again later!");
                    }
                    btn.innerHTML = this.btnText;
                },
                onTimeout: () => { btn.innerHTML = this.btnText; }
            });
        }

        inject() {
            setInterval(() => {
                let videos = document.querySelectorAll("video:not([data-tagged])");
                for (let video of videos) {
                    video.setAttribute("data-tagged", "true");
                    console.log(document.querySelector("#container"));
                    this.addVideoButton(document.querySelector("#container.ytd-player"));

                }
            }, 200);
            Mordo95DL.addStyle(".dlBtn{position:absolute;top:0;right:0;z-index:99999;padding:10px 15px;margin:5px;cursor:pointer;outline:0;background:#5383FB;color:white;border:1px solid 1px solid #5383FB;font-family: Segoe UI Historic, Segoe UI, Helvetica, Arial, sans-serif !important;font-size:12px;}");
            Mordo95DL.addStyle(".dlBtn:hover{background-color:#86A4FC}");
        }

        constructor() {
            this.btnText = "Download (HD)";
        }
    }

    class RDDL {
        addVideoButton(on, videoEl) {
            on.querySelectorAll(".dlBtn").forEach(el => el.remove());
            let btn = document.createElement("div");
            btn.innerHTML = this.btnText;
            btn.classList.add("dlBtn");
            btn.onclick = () => this.btnAct(btn);
            on.prepend(btn);
        }

        btnAct(btn) {
            let src = this.returnUntil(this.getReactInternalState(btn.parentElement), "mpegDashSource");
            if (!src) {
                alert("Unable to load video data");
                return;
            }
            let mpegDashUrl = src.pendingProps.mpegDashSource;
            let match = mpegDashUrl.match(/https:\/\/v.redd.it\/(?<videoId>.+)\/DASHPlaylist\.mpd/);
            if (!match) {
                alert("Unable to load video data");
                return;
            }
            let videoId = match.groups.videoId;
            let p = Mordo95DL.buildParams({
                video_url: 'https://v.redd.it/' + videoId + '/DASH_720.mp4?source=fallback',
                audio_url: 'https://v.redd.it/' + videoId + '/DASH_audio.mp4?source=fallback',
                permalink: window.location.origin + src.pendingProps.postUrl.pathname
            });
            window.open("https://ds.redditsave.com/download.php?" + p);
        }

        getReactInternalState(el) {
            for (let prop of Object.keys(el)) {
                if (prop.startsWith("__reactInternalInstance")) {
                    return el[prop];
                }
            }
            return null;
        }

        returnUntil(inst, prop) {
            let fInst = inst;
            while (fInst != null) {
                if (fInst.pendingProps[prop])
                    return fInst;

                fInst = fInst.return;
            }
            return null;
        }

        inject() {
            setInterval(() => {
                let videos = document.querySelectorAll("video:not([data-tagged])");
                for (let video of videos) {
                    if (video.parentElement.querySelector(".dlBtn") == null && video.parentElement.parentElement.firstChild.getAttribute("role") !== "slider")
                        this.addVideoButton(video.parentElement);
                }
            }, 200);

            Mordo95DL.addStyle(".dlBtn{position:absolute;top:0;right:0;z-index:99999;padding:10px 15px;margin:5px;cursor:pointer;outline:0;background:#5383FB;color:white;border:1px solid 1px solid #5383FB;font-family: Segoe UI Historic, Segoe UI, Helvetica, Arial, sans-serif !important;font-size:12px;}");
            Mordo95DL.addStyle(".dlBtn:hover{background-color:#86A4FC}");
        }

        constructor() {
            this.btnText = "Download (HD)";
        }
    }
    document.addEventListener('DOMContentLoaded', () => {
        if (window.location.href.match(/youtu(\.)?be.*/)) { new YTDL().inject(); }
        if (window.location.href.match(/facebook\..*/)) { new FBDL().inject(); }
        if (window.location.href.match(/reddit\..*/)) { new RDDL().inject(); }
    }, false);

})();
