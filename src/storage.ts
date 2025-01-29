/*
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { getLogger } from "log4js";

const log = getLogger('Storage');

function genFullKey(short: string): string {
    return `mx_f_${short}`;
}

export function storeValue(key: string, value: any) {
    const fullKey = genFullKey(key);
    log.debug(`localStorage.setItem(${fullKey}) = ${value}`);
    localStorage.setItem(fullKey, JSON.stringify(value));
}

export function readValueNoDefault<T>(key: string): T | undefined {
    return readValue(key, undefined);
}

export function readValue<T>(key: string, def: T): T {
    const fullKey = genFullKey(key);
    const val = localStorage.getItem(fullKey);
    log.debug(`localStorage.getItem(${fullKey}) = ${val}`);
    if (val === null || val === undefined) return def;
    try {
        return JSON.parse(val);
    } catch (e) {
        storeValue(fullKey, def);
        return def;
    }
}
