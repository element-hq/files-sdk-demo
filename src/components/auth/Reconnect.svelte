<!--
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
-->

<script lang="ts">
    import router from 'page';
    import type { ClientManager } from "../../ClientManager";
    import Textfield from "@smui/textfield";
    import Button, { Label } from "@smui/button";
    import { Title } from "@smui/paper";
    import CircularProgress from '@smui/circular-progress';
    import { ConnectionError } from 'matrix-js-sdk/lib';

    export let clientManager: ClientManager;

    let errorMessage = '';
    let loading = false;

    async function connect() {
        try {
            errorMessage = '';
            loading = true;
            await clientManager.rehydrate();
            router.redirect(clientManager.nextRoute ?? '/home');
            clientManager.nextRoute = undefined;
        } catch (e: any) {
            console.error(e);
            errorMessage = [e.errcode, e.cause?.message ?? e.message].filter(x => !!x).join(': ');
            if (e instanceof ConnectionError) {
                errorMessage += '. Is the homeserver up?';
            }
        } finally {
            loading = false;
        }
    }

    async function logout() {
        await clientManager.logout()
        router.redirect('/signin');
    }

    connect().then().catch(console.error);
</script>

<div>
    <Title style="font-size: 24px; font-weight: 600; ">Reconnect</Title>

    {#if errorMessage}
        <p style="color: red; text-align: center; font-weight: bold;">
            {errorMessage}
        </p>
    {/if}

    <form on:submit|preventDefault={() => connect()}>
        <Textfield variant="outlined" label="Homeserver" type="text" bind:value={clientManager.homeserverUrl} style="margin-top: 16px;" disabled />
        <Textfield variant="outlined" label="Username" type="text" bind:value={clientManager.userId} style="margin-top: 16px;" disabled />
        <Button type="submit" variant="unelevated" disabled={loading}>
            {#if loading}
                <CircularProgress indeterminate style="height: 24px; width: 24px; margin-left: 8px;" />
                Connecting...
            {:else}
                Try again now
            {/if}
        </Button>
        <p>
            <Button on:click:preventDefault={() => logout()} href="#">
                <Label>Sign out</Label>
            </Button>
        </p>
    </form>    
</div>
