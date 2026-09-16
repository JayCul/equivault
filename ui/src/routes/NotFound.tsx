import { ButtonLink, EmptyState, Section } from '../components/ui';

export const NotFound = () => (
  <Section className="py-28">
    <EmptyState
      title="That page does not exist"
      action={
        <ButtonLink to="/" size="sm" variant="secondary">
          Back to EquiVault
        </ButtonLink>
      }
    >
      The link may be out of date, or the offering may not be loaded in this session.
    </EmptyState>
  </Section>
);
