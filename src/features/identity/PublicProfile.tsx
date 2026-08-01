// Public profile /u/:handle (design §F.2). Full profile + reviews land in task 7.6.
import { useParams } from 'react-router-dom';

export function PublicProfile() {
  const { handle } = useParams<{ handle: string }>();
  return (
    <section style={{ padding: 16 }}>
      <h1 style={{ textTransform: 'lowercase' }}>@{handle}</h1>
      <p>public profile arrives in phase 3.</p>
    </section>
  );
}
