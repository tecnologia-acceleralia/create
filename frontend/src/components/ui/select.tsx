import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/utils/cn';

type SelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  placeholder?: string;
};

const mergeRefs = <T,>(...refs: Array<React.Ref<T> | undefined>) => {
  return (value: T) => {
    for (const ref of refs) {
      if (typeof ref === 'function') {
        ref(value);
      } else if (ref) {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    }
  };
};

const extractOptions = (children: React.ReactNode): SelectOption[] =>
  React.Children.toArray(children)
    .map(child => {
      if (!React.isValidElement(child)) {
        return null;
      }
      if (child.type === 'optgroup') {
        return extractOptions(child.props.children);
      }
      if (
        typeof child.type === 'string' &&
        child.type.toLowerCase() === 'option'
      ) {
        const optionValue =
          child.props.value ?? (typeof child.props.children === 'string' ? child.props.children : '');
        return {
          value: String(optionValue),
          label: child.props.children,
          disabled: child.props.disabled
        };
      }
      return null;
    })
    .flat()
    .filter((option): option is SelectOption => Boolean(option));

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      children,
      disabled,
      placeholder,
      name,
      value,
      defaultValue,
      onChange,
      onBlur,
      onFocus,
      required,
      ...rest
    },
    ref
  ) => {
    const extractedOptions = React.useMemo(() => extractOptions(children), [children]);
    const { options, placeholderText } = React.useMemo(() => {
      const placeholderOption = extractedOptions.find(option => option.value === '');
      const filteredOptions = extractedOptions.filter(option => option.value !== '');
      const derivedPlaceholder =
        placeholder ??
        (typeof placeholderOption?.label === 'string'
          ? placeholderOption.label
          : placeholderOption?.label
            ? String(placeholderOption.label)
            : undefined) ??
        (typeof filteredOptions[0]?.label === 'string' ? (filteredOptions[0]?.label as string) : 'Selecciona una opción');

      return {
        options: filteredOptions,
        placeholderText: derivedPlaceholder
      };
    }, [extractedOptions, placeholder]);
    const hiddenSelectRef = React.useRef<HTMLSelectElement | null>(null);
    const isControlled = value !== undefined;

    const resolveInitialValue = React.useCallback(() => {
      if (isControlled) {
        return value === null || value === undefined ? '' : String(value);
      }
      if (defaultValue !== undefined && defaultValue !== null) {
        return String(defaultValue);
      }
      const selectedChild = React.Children.toArray(children).find(
        child =>
          React.isValidElement(child) &&
          typeof child.type === 'string' &&
          child.type.toLowerCase() === 'option' &&
          child.props.selected
      ) as React.ReactElement | undefined;
      if (selectedChild?.props?.value !== undefined) {
        return String(selectedChild.props.value);
      }
      return String(options[0]?.value ?? '');
    }, [children, defaultValue, isControlled, options, value]);

    const [internalValue, setInternalValue] = React.useState<string>(resolveInitialValue);

    React.useEffect(() => {
      if (isControlled) {
        setInternalValue(value === null || value === undefined ? '' : String(value));
      }
    }, [isControlled, value]);

    React.useEffect(() => {
      if (!isControlled) {
        setInternalValue(resolveInitialValue());
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options.length]);

    const syncHiddenSelect = React.useCallback(
      (nextValue: string) => {
        const selectElement = hiddenSelectRef.current;
        if (!selectElement) {
          return;
        }
        const nativeSetter = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          'value'
        )?.set;
        nativeSetter?.call(selectElement, nextValue);
        const event = new Event('change', { bubbles: true });
        selectElement.dispatchEvent(event);
      },
      []
    );

    const fireFocusEvent = (type: 'focus' | 'blur') => {
      const selectElement = hiddenSelectRef.current;
      if (!selectElement) {
        return;
      }
      const event =
        typeof window !== 'undefined' && typeof window.FocusEvent === 'function'
          ? new FocusEvent(type, { bubbles: false })
          : new Event(type, { bubbles: false });
      selectElement.dispatchEvent(event);
    };

    const handleValueChange = (nextValue: string) => {
      if (!isControlled) {
        setInternalValue(nextValue);
      }
      syncHiddenSelect(nextValue);
    };

    const selectedOption = options.find(option => option.value === internalValue);

    return (
      <div className={cn('relative w-full', className)}>
        <SelectPrimitive.Root
          value={internalValue}
          onValueChange={handleValueChange}
          disabled={disabled}
        >
          <SelectPrimitive.Trigger
            className={cn(
              'group flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 text-sm font-medium text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 data-[state=open]:border-primary data-[state=open]:shadow-md data-[state=open]:shadow-primary/10',
              disabled && 'opacity-60'
            )}
            onBlur={() => fireFocusEvent('blur')}
            onFocus={() => fireFocusEvent('focus')}
          >
            <SelectPrimitive.Value
              placeholder={placeholderText}
              className="truncate text-left"
            />
            <SelectPrimitive.Icon>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition group-data-[state=open]:rotate-180 group-data-[state=open]:text-primary" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>

          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              sideOffset={8}
              align="start"
              className="z-[70] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-border/70 bg-card/95 text-foreground shadow-2xl backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
              position="popper"
            >
              <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1 text-muted-foreground">
                <ChevronUp className="h-4 w-4" />
              </SelectPrimitive.ScrollUpButton>
              <SelectPrimitive.Viewport className="max-h-60 p-2">
                {options.map(option => (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className={cn(
                      'relative flex select-none items-center rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition',
                      'data-[state=checked]:bg-primary/10 data-[state=checked]:text-foreground',
                      'data-[highlighted]:bg-muted/60 data-[highlighted]:text-foreground',
                      'data-[disabled]:pointer-events-none data-[disabled]:opacity-40'
                    )}
                  >
                    <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="absolute right-3 flex items-center">
                      <Check className="h-4 w-4 text-primary" />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
              <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1 text-muted-foreground">
                <ChevronDown className="h-4 w-4" />
              </SelectPrimitive.ScrollDownButton>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>

        <select
          {...rest}
          ref={mergeRefs(ref, hiddenSelectRef)}
          name={name}
          value={internalValue}
          onChange={event => {
            if (isControlled) {
              onChange?.(event);
              return;
            }
            setInternalValue(event.target.value);
            onChange?.(event);
          }}
          onBlur={onBlur}
          onFocus={onFocus}
          disabled={disabled}
          required={required}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        >
          {children}
        </select>
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };

