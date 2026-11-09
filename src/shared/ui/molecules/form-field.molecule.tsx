import { Show, type JSX } from "solid-js";
import { Input, Label } from "../atoms";
import { cn } from "../cn";

export type FormFieldProps = {
  readonly id: string;
  readonly label: string;
  readonly type?: "text" | "email" | "password";
  readonly value: string;
  readonly placeholder?: string;
  readonly autocomplete?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly errorMessage?: string | null;
  readonly rightAction?: JSX.Element;
  readonly class?: string;
  readonly onInput: (value: string) => void;
};

export const FormField = (props: FormFieldProps): JSX.Element => (
  <div class={cn("flex flex-col gap-1.5", props.class)}>
    <div class="flex items-center justify-between">
      <Label for={props.id}>{props.label}</Label>
      {props.rightAction}
    </div>
    <Input
      id={props.id}
      name={props.id}
      type={props.type}
      value={props.value}
      placeholder={props.placeholder}
      autocomplete={props.autocomplete}
      disabled={props.disabled}
      required={props.required}
      hasError={Boolean(props.errorMessage)}
      onInput={props.onInput}
    />
    <Show when={props.errorMessage}>
      {(message) => (
        <p role="alert" class="text-xs text-red-600 dark:text-red-400">
          {message()}
        </p>
      )}
    </Show>
  </div>
);

