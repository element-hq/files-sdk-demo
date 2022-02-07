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

<script lang="ts">
    import Dialog, { Title, Content, Actions, InitialFocus } from '@smui/dialog';
    import Button, { Label } from '@smui/button';
    import Textfield, { TextfieldComponentDev } from '@smui/textfield';
    import HelperText from '@smui/textfield/helper-text';

    type Validator = (value: string) => string | boolean; 

    let textfield: TextfieldComponentDev;
    let _title: string;
    let _value: string = '';
    let _validator: Validator | undefined;

    let _open = false;
    let _resolve: (value: string | undefined | PromiseLike<string | undefined>) => void;

    let invalid = false;
    let helperText = '';

    let _label = '';
    let _buttonTitle = '';

    $: {
        if (_validator) {
            const validatorResponse = _validator(_value);
            invalid = validatorResponse !== true;
            if (invalid) {
                helperText = typeof validatorResponse === 'string' ? validatorResponse : '';
            } else {
                helperText = '';
            }
        }
    }

    export async function open(title: string, value: string, label: string, buttonTitle: string, validator?: Validator): Promise<string | undefined> {
        _title = title;
        _value = value;
        _open = true;
        _label = label;
        _buttonTitle = buttonTitle;
        _validator = validator;
        setTimeout(() => textfield.getElement().getElementsByTagName<'input'>('input').item(0)?.select(), 100);
        return new Promise<string | undefined>((resolve) => {
            _resolve = resolve;
        });
    }

    function enterPressed() {
        _resolve(_value);
        _open = false;
    }

    function onKeyUp(e: CustomEvent<KeyboardEvent>) {
        // TODO: figure out why the types are broken here
        if (!invalid && (e as unknown as KeyboardEvent).key === 'Enter') enterPressed();
    }

    function closeHandler(e: CustomEvent<{ action: string }>) {
        if (e.detail.action === 'ok') {
            _resolve(_value);
        } else {
            _resolve(undefined);
        }
        _open = false;
    }
</script>

<Dialog
    bind:open={_open}
    on:MDCDialog:closed={closeHandler}
    class="textfield-dialog"
>
    {#if _title}
        <Title style="font-size: 24px; font-weight: 600;">{_title}</Title>
    {/if}
    <Content>
        <Textfield
            on:keyup={onKeyUp}
            use={[InitialFocus]}
            variant="outlined"
            type="text"
            bind:value={_value}
            bind:this={textfield}
            required
            label={_label}
            invalid={invalid}
            style="width: 100%;"
        >
            <HelperText slot="helper">{helperText}</HelperText>
        </Textfield>
        </Content>
        <Actions>
        <Button variant="outlined">
            <Label>Cancel</Label>
        </Button>
        <Button action="ok" variant="unelevated" disabled={invalid}>
            <Label>{ _buttonTitle }</Label>
        </Button>
    </Actions>
</Dialog>

<style lang="scss">
    :global(.textfield-dialog) {
        :global(.mdc-dialog__surface) {
            min-width: 400px !important;
            border-radius: 8px !important;
            box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.15) !important;
        }
        :global(.mdc-dialog__content) {
            padding-top: 10px !important;
        }
    }
</style>