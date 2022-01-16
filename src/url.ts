/*
Copyright 2021-2022 New Vector Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * Reactive URL functions
 */

import { derived, writable } from "svelte/store";

const isBrowser = typeof window !== "undefined";

const href = writable(isBrowser ? window.location.href : "blank://");

const URL = isBrowser ? window.URL : require("url").URL;

if (isBrowser) {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    const updateHref = () => href.set(window.location.href);

    history.pushState = function(...args) {
        originalPushState.apply(this, args);
        updateHref();
    };

    history.replaceState = function(...args) {
        originalReplaceState.apply(this, args);
        updateHref();
    };

    window.addEventListener("popstate", updateHref);
    window.addEventListener("hashchange", updateHref);
}

export default {
    subscribe: derived(href, $href => new URL($href)).subscribe,
    ssrSet: (urlHref: string) => href.set(urlHref),
};
