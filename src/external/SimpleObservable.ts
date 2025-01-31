/*
 * Copyright 2025 New Vector Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// Borrowed with permission from matrix-widget-api

export type ObservableFunction<T> = (val: T) => void;

export class SimpleObservable<T> {
    private listeners: ObservableFunction<T>[] = [];
    public value: T | undefined;

    public constructor(initialValue?: T) {
        this.value = initialValue;
    }

    public onUpdate(fn: ObservableFunction<T>) {
        this.listeners.push(fn);
    }

    public update(val: T) {
        this.value = val;
        for (const listener of this.listeners) {
            listener(val);
        }
    }

    public close() {
        this.listeners = []; // reset
    }
}
