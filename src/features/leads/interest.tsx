import { interestHints, interestLabels, type LeadInterest } from "./score";

export function InterestBadge({ interest }: { interest: LeadInterest }) {
  return (
    <span className={`interest interest-${interest.level.toLowerCase()}`}>
      {interestLabels[interest.level]}
      {interest.level !== "CLOSED" && interest.level !== "LOST" && (
        <strong>{interest.score}</strong>
      )}
    </span>
  );
}

export function InterestDetails({ interest }: { interest: LeadInterest }) {
  return (
    <section className="form-card">
      <h2>Nível de interesse</h2>
      <p>
        <InterestBadge interest={interest} /> {interestHints[interest.level]}
      </p>
      {interest.level !== "CLOSED" && interest.level !== "LOST" && (
        <meter
          className="interest-meter"
          min={0}
          max={100}
          low={30}
          high={60}
          optimum={100}
          value={interest.score}
          aria-label={`Pontuação de interesse: ${interest.score} de 100`}
        />
      )}
      {interest.reasons.length > 0 ? (
        <ul className="interest-reasons">
          {interest.reasons.map((reason) => (
            <li key={reason.label}>
              <span>{reason.label}</span>
              <span className={reason.points < 0 ? "negative" : ""}>
                {reason.points > 0 ? "+" : ""}
                {reason.points}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        interest.level === "COLD" && (
          <p className="muted">
            Ainda sem sinais de interesse: o visitante deixou o contato, mas não
            explorou o tour nem pediu visita.
          </p>
        )
      )}
      {!interest.measured &&
        interest.level !== "CLOSED" &&
        interest.level !== "LOST" && (
          <p className="muted">
            Este visitante não autorizou a medição do tour: a nota considera
            apenas retornos e pedidos de visita. Um contato direto pode revelar
            mais interesse do que a nota indica.
          </p>
        )}
      <p className="muted">
        Calculado a partir do comportamento registrado no tour e dos pedidos de
        visita. Quente: 60 ou mais · Morno: 30 a 59 · Frio: abaixo de 30.
      </p>
    </section>
  );
}
