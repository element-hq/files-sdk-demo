/*
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
