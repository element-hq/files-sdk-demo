/*
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Required to make the site actually work.
import App from './components/App.svelte';

const app = new App({
	target: document.body,
});

export default app;
