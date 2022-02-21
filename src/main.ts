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

import App from './components/App.svelte';

// const console = require('log4js/lib/appenders/console');
// import * as Configuration from 'log4js/lib/configuration';

// Configuration.prototype.loadAppenderModule = function() {
// 	return console;
// };

import { configure, getLogger } from 'log4js';

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
            level: 'info',
        },
        MatrixFilesSDK: {
            appenders: ['console'],
            level: 'trace',
        },
    },
});

getLogger('main').info('log4js configured');

// Required to make the site actually work.

const app = new App({
	target: document.body,
});

export default app;
