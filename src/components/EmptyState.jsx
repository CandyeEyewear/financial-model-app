/**
 * Empty State Components
 * Beautiful empty states for when there's no data
 */
import React from 'react';
import { Button } from './Button';
import { 
  FileText, 
  Database, 
  Search, 
  Folder, 
  BarChart3, 
  Settings,
  AlertCircle,
  Plus,
  Upload,
  RefreshCw
} from 'lucide-react';

/**
 * EmptyState - Versatile empty state component
 * 
 * @component
 * @example
 * <EmptyState
 *   title="No projects yet"
 *   description="Create your first project to get started"
 *   action={{ label: 'Create Project', onClick: handleCreate }}
 * />
 */
export function EmptyState({
  // Content
  title,
  description,
  
  // Visual
  icon: CustomIcon,
  illustration,
  variant = 'default', // 'default' | 'compact' | 'inline'
  
  // Actions
  action, // { label, onClick, variant? }
  secondaryAction, // { label, onClick }
  
  // Styling
  className = '',
}) {
  const Icon = CustomIcon || FileText;
  
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-3 p-4 text-neutral-500 dark:text-neutral-400 ${className}`}>
        <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
        <span className="text-sm">{title}</span>
        {action && (
          <Button
            variant="link"
            size="sm"
            onClick={action.onClick}
            className="ml-auto"
          >
            {action.label}
          </Button>
        )}
      </div>
    );
  }
  
  if (variant === 'compact') {
    return (
      <div className={`text-center py-8 px-4 ${className}`}>
        <Icon 
          className="w-10 h-10 mx-auto mb-3 text-neutral-300 dark:text-neutral-600" 
          aria-hidden="true"
        />
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
            {description}
          </p>
        )}
        {action && (
          <Button
            variant={action.variant || 'primary'}
            size="sm"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </div>
    );
  }
  
  // Default variant
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      {illustration ? (
        <div className="mb-6">{illustration}</div>
      ) : (
        <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-6">
          <Icon 
            className="w-8 h-8 text-neutral-400 dark:text-neutral-500" 
            aria-hidden="true"
          />
        </div>
      )}
      
      <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mb-6">
          {description}
        </p>
      )}
      
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action && (
            <Button
              variant={action.variant || 'primary'}
              onClick={action.onClick}
              leftIcon={action.icon}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="secondary"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Pre-built empty states for common scenarios
 */

export function NoDataEmptyState({ onAction, actionLabel = 'Add Data' }) {
  return (
    <EmptyState
      icon={Database}
      title="No data available"
      description="Start by adding some data to see it displayed here."
      action={onAction && { label: actionLabel, onClick: onAction, icon: Plus }}
    />
  );
}

export function NoSearchResultsEmptyState({ searchTerm, onClear }) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={`We couldn't find anything matching "${searchTerm}". Try adjusting your search.`}
      action={onClear && { label: 'Clear search', onClick: onClear }}
    />
  );
}

export function NoModelsEmptyState({ onCreate }) {
  return (
    <EmptyState
      icon={BarChart3}
      title="No financial models yet"
      description="Create your first financial model to start analyzing deals and scenarios."
      action={onCreate && { label: 'Create Model', onClick: onCreate, icon: Plus }}
    />
  );
}

export function NoScenariosEmptyState({ onCreate }) {
  return (
    <EmptyState
      icon={Folder}
      title="No scenarios saved"
      description="Save your current scenario to compare with others later."
      action={onCreate && { label: 'Save Scenario', onClick: onCreate }}
    />
  );
}

export function ErrorEmptyState({ onRetry, errorMessage }) {
  return (
    <EmptyState
      icon={AlertCircle}
      title="Something went wrong"
      description={errorMessage || "We encountered an error loading this content. Please try again."}
      action={onRetry && { label: 'Try Again', onClick: onRetry, icon: RefreshCw }}
    />
  );
}

export function NoReportsEmptyState({ onGenerate }) {
  return (
    <EmptyState
      icon={FileText}
      title="No reports generated"
      description="Generate your first report to share insights with stakeholders."
      action={onGenerate && { label: 'Generate Report', onClick: onGenerate }}
    />
  );
}

export function UploadEmptyState({ onUpload, accept }) {
  return (
    <EmptyState
      icon={Upload}
      title="Upload a file"
      description="Drag and drop a file here, or click to browse."
      action={onUpload && { label: 'Browse Files', onClick: onUpload, icon: Upload }}
    />
  );
}

export function ConfigurationEmptyState({ onConfigure }) {
  return (
    <EmptyState
      icon={Settings}
      title="Configuration required"
      description="Please configure the required settings to continue."
      action={onConfigure && { label: 'Configure', onClick: onConfigure, icon: Settings }}
    />
  );
}

/**
 * Empty state for tables
 */
export function TableEmptyState({ 
  title = 'No data', 
  description,
  action 
}) {
  return (
    <tr>
      <td colSpan="100%" className="py-12">
        <EmptyState
          variant="compact"
          title={title}
          description={description}
          action={action}
        />
      </td>
    </tr>
  );
}

export default EmptyState;
