interface Props {
  simError: Error | null;
  otherError: Error | null;
  loading: boolean;
}

/**
 * Surface backend connectivity as a banner instead of silently drawing empty
 * tiles. If /api/simulation/status is unreachable, controls and live values
 * are all meaningless — say so up front.
 */
export default function BackendBanner({ simError, otherError, loading }: Props) {
  if (simError) {
    return (
      <div className="backend-banner backend-banner--error">
        <div className="backend-banner__title">
          <span className="dot" />
          producer service unreachable
        </div>
        <div className="backend-banner__body">
          <code>GET /api/simulation/status</code> failed:{" "}
          <em>{simError.message}</em>
          <br />
          Start the stack with <code>docker compose up -d</code> or run
          <code> ./mvnw spring-boot:run</code> inside{" "}
          <code>producer-service</code>.
        </div>
      </div>
    );
  }
  if (otherError) {
    return (
      <div className="backend-banner backend-banner--warn">
        <div className="backend-banner__title">
          <span className="dot" />
          consumer endpoint returning errors
        </div>
        <div className="backend-banner__body">
          Producer is reachable, but one of the consumer endpoints is not:{" "}
          <em>{otherError.message}</em>. Latest / history tiles may be empty
          until it recovers.
        </div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="backend-banner backend-banner--info">
        <div className="backend-banner__title">
          <span className="dot" />
          connecting to producer
        </div>
        <div className="backend-banner__body">
          Polling <code>/api/simulation/status</code>…
        </div>
      </div>
    );
  }
  return null;
}
