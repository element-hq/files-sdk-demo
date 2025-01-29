/*
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { configure, getLogger } from 'log4js';
import { Log } from 'oidc-client-ts';

configure({
    appenders: {
        console: {
            type: 'console',
            layout: { type: 'coloured' },
        },
    },
    categories: {
        default: {
            appenders: ['console'],
            level: 'debug',
        },
        OIDC: {
            appenders: ['console'],
            level: 'info',
        },
        Storage: {
            appenders: ['console'],
            level: 'info',
        },
        MatrixFilesSDK: {
            appenders: ['console'],
            level: 'trace',
        },
    },
});

getLogger('logging').info('log4js configured');

Log.setLogger(getLogger('OIDC'));
Log.setLevel(Log.DEBUG);
