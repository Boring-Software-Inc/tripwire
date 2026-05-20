import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useFeedback } from './context';

export function FeedbackTrigger({
  children,
  mode = 'select',
}: {
  children: ReactNode;
  mode?: 'select' | 'direct';
}) {
  const { open, startSelection } = useFeedback();
  const handler = mode === 'direct' ? open : startSelection;

  if (!isValidElement(children)) {
    return (
      <button type="button" onClick={handler}>
        {children}
      </button>
    );
  }

  const child = children as ReactElement<{
    onClick?: (...args: unknown[]) => void;
  }>;

  return cloneElement(child, {
    onClick: (...args: unknown[]) => {
      child.props.onClick?.(...args);
      handler();
    },
  });
}
