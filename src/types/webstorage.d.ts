/*
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// TODO remove this file when types are provided for https://github.com/matrix-org/matrix-js-sdk/blob/develop/src/store/session/webstorage.js
declare module 'matrix-js-sdk/lib/store/session/webstorage' {
  export class WebStorageSessionStore {
      constructor(storage: Storage);
  }
}
