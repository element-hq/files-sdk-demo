<!--
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
-->

<svelte:head>
    <title>Login</title>
</svelte:head>

<script lang="ts">
    import router from 'page';
    import type { ClientManager } from "../../ClientManager";
    import Textfield from "@smui/textfield";
    import HelperText from "@smui/textfield/helper-text";
    import Button, { Label } from "@smui/button";
    import { Title } from "@smui/paper";
    import CircularProgress from '@smui/circular-progress';

    export let clientManager: ClientManager;

    let errorMessage = '';
    let loading = false;

    async function login() {
        try {
            errorMessage = '';
            loading = true;
            await clientManager.login();
            router.replace('/');
        } catch (e: any) {
            console.error(e);
            errorMessage = [e.errcode, e.cause?.message ?? e.message].filter(x => !!x).join(': ');
        } finally {
            loading = false;
        }
    }
</script>

<div>
    <Title style="font-size: 24px; font-weight: 600; ">Sign in</Title>
    <p>
        <strong>Please use a dedicated test account. The homeserver also needs to allow high request rates.</strong>
    </p>

    {#if errorMessage}
        <p style="color: red; text-align: center; font-weight: bold;">
            {errorMessage}
        </p>
    {/if}

    <form on:submit|preventDefault={() => login()}>
        <Textfield variant="outlined" label="Homeserver" type="text" bind:value={clientManager.homeserverUrl} required style="margin-top: 16px;">
            <HelperText slot="helper">e.g. https://matrix.org</HelperText>
        </Textfield>
        <Textfield variant="outlined" label="Username" type="text" bind:value={clientManager.userId} required style="margin-top: 16px;">
            <HelperText slot="helper">Your matrix username</HelperText>
        </Textfield>
        <Textfield variant="outlined" label="Password" type="password" bind:value={clientManager.password} required style="margin-top: 16px;">
            <HelperText slot="helper">Your matrix password</HelperText>
        </Textfield>
        <Button type="submit" variant="unelevated" disabled={loading}>
            Sign in
            {#if loading}
                <CircularProgress indeterminate style="height: 24px; width: 24px; margin-left: 8px;" />
            {/if}
        </Button>
        <p>
            New?
            <Button on:click:preventDefault={() => router.show('/register')} href="#">
                <Label>Create account</Label>
            </Button>
        </p>
        <p>
            <i>It is recommended to use a dedicated test account as the E2E encryption settings used in this beta version may clash with your existing account and your keys get lost.</i>
        </p>
    </form>    
</div>
