/*
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

declare module 'svelte-accordion' {
  import type { SvelteComponent } from "svelte";

  class Section extends SvelteComponent {};
  export default class Accordion extends SvelteComponent {
    static Section: typeof Section;
  };
}
