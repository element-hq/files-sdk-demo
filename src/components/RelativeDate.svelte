<!--
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
-->

<script lang="ts">
    import dayjs, { Dayjs } from 'dayjs';

    export let date: Date | null | undefined;

    let value: Dayjs | null;

    $: value = date ? dayjs(date) : null;
</script>

{#if (value)}
    <span title="{value.format('LLLL')}">
        {#if dayjs().diff(value, 'hours') < 24}
            {value.format('LT')}
        {:else}
            {value.format('L')}
        {/if}
    </span>
{:else}
    <span>-</span>
{/if}

<style>
</style>
