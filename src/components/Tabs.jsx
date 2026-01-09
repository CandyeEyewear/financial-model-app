/**
 * Accessible Tabs Component
 * WCAG 2.1 AA Compliant - Full keyboard navigation support
 */
import React, { useState, useRef, useId, useCallback } from 'react';

/**
 * Tabs container component
 * Implements WAI-ARIA Tabs pattern
 * 
 * @component
 * @example
 * <Tabs defaultValue="tab1">
 *   <TabsList aria-label="Main sections">
 *     <TabsTrigger value="tab1">Tab 1</TabsTrigger>
 *     <TabsTrigger value="tab2">Tab 2</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="tab1">Content 1</TabsContent>
 *   <TabsContent value="tab2">Content 2</TabsContent>
 * </Tabs>
 */
export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  className = '',
  orientation = 'horizontal', // 'horizontal' | 'vertical'
}) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const generatedId = useId();
  
  // Use controlled or uncontrolled value
  const isControlled = controlledValue !== undefined;
  const activeTab = isControlled ? controlledValue : uncontrolledValue;
  
  const handleTabChange = useCallback((newValue) => {
    if (!isControlled) {
      setUncontrolledValue(newValue);
    }
    onValueChange?.(newValue);
  }, [isControlled, onValueChange]);
  
  // Extract tab values from TabsTrigger children
  const getTabValues = () => {
    const values = [];
    React.Children.forEach(children, (child) => {
      if (child?.type === TabsList) {
        React.Children.forEach(child.props.children, (trigger) => {
          if (trigger?.props?.value) {
            values.push(trigger.props.value);
          }
        });
      }
    });
    return values;
  };
  
  const tabValues = getTabValues();
  
  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    const currentIndex = tabValues.indexOf(activeTab);
    let nextIndex = currentIndex;
    
    if (orientation === 'horizontal') {
      if (e.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % tabValues.length;
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (currentIndex - 1 + tabValues.length) % tabValues.length;
      } else if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = tabValues.length - 1;
      }
    } else {
      if (e.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % tabValues.length;
      } else if (e.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + tabValues.length) % tabValues.length;
      } else if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = tabValues.length - 1;
      }
    }
    
    if (nextIndex !== currentIndex) {
      e.preventDefault();
      handleTabChange(tabValues[nextIndex]);
    }
  }, [activeTab, tabValues, orientation, handleTabChange]);
  
  return (
    <div 
      className={`${orientation === 'vertical' ? 'flex gap-4' : ''} ${className}`}
      data-orientation={orientation}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        
        return React.cloneElement(child, {
          activeTab,
          onTabChange: handleTabChange,
          onKeyDown: handleKeyDown,
          tabsId: generatedId,
          orientation,
        });
      })}
    </div>
  );
}

/**
 * TabsList - Container for tab triggers
 */
export function TabsList({
  children,
  activeTab,
  onTabChange,
  onKeyDown,
  tabsId,
  orientation = 'horizontal',
  className = '',
  'aria-label': ariaLabel,
  ...props
}) {
  const tabListRef = useRef(null);
  
  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation={orientation}
      onKeyDown={onKeyDown}
      className={`
        ${orientation === 'horizontal' 
          ? 'inline-flex items-center gap-1 p-1.5 rounded-card bg-neutral-100 dark:bg-neutral-800' 
          : 'flex flex-col gap-1 p-1.5 rounded-card bg-neutral-100 dark:bg-neutral-800'
        }
        ${className}
      `}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        
        return React.cloneElement(child, {
          activeTab,
          onTabChange,
          tabsId,
        });
      })}
    </div>
  );
}

/**
 * TabsTrigger - Individual tab button
 */
export function TabsTrigger({
  value,
  children,
  activeTab,
  onTabChange,
  tabsId,
  disabled = false,
  className = '',
  icon: Icon,
  ...props
}) {
  const isActive = activeTab === value;
  const triggerId = `${tabsId}-trigger-${value}`;
  const panelId = `${tabsId}-panel-${value}`;
  
  return (
    <button
      role="tab"
      type="button"
      id={triggerId}
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={() => onTabChange?.(value)}
      className={`
        inline-flex items-center justify-center gap-2
        px-4 py-2.5
        text-sm font-semibold
        rounded-button
        transition-all duration-normal
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        
        ${isActive
          ? 'bg-white dark:bg-neutral-700 text-primary-700 dark:text-primary-300 shadow-sm'
          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50'
        }
        ${className}
      `}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
      {children}
    </button>
  );
}

/**
 * TabsContent - Tab panel content
 */
export function TabsContent({
  value,
  children,
  activeTab,
  tabsId,
  className = '',
  forceMount = false,
  ...props
}) {
  const isActive = activeTab === value;
  const triggerId = `${tabsId}-trigger-${value}`;
  const panelId = `${tabsId}-panel-${value}`;
  
  // Don't render if not active and not forced
  if (!isActive && !forceMount) {
    return null;
  }
  
  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={triggerId}
      hidden={!isActive}
      tabIndex={0}
      className={`
        mt-4
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
        ${!isActive ? 'hidden' : ''}
        ${isActive ? 'animate-fade-in' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export default Tabs;
