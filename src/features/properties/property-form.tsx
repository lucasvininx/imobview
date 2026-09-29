"use client";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { propertySchema, type PropertyInput } from "./schema";
import { savePropertyAction } from "./actions";
import { Button } from "@/components/ui";
export const defaultProperty: PropertyInput = {
  title: "",
  description: "",
  type: "APARTMENT",
  purpose: "SALE",
  neighborhood: "",
  city: "",
  state: "SP",
  price: "0",
  area: 0,
  bedrooms: 0,
  bathrooms: 0,
  parkingSpaces: 0,
};
const stageFields: FieldPath<PropertyInput>[][] = [
  ["title", "description", "type", "purpose"],
  [
    "neighborhood",
    "city",
    "state",
    "price",
    "area",
    "bedrooms",
    "bathrooms",
    "parkingSpaces",
  ],
];
export function PropertyForm({
  initial = defaultProperty,
  id,
}: {
  initial?: PropertyInput;
  id?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PropertyInput>({
    resolver: zodResolver(propertySchema),
    defaultValues: initial,
  });
  useUnsavedChanges(isDirty);
  const submit = handleSubmit(async (data) => {
    setError("");
    try {
      const result = await savePropertyAction(data, id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      reset(data);
      setSaved(true);
      router.push(`/app/imoveis/${result.id}?salvo=1`);
      router.refresh();
    } catch {
      setError(
        "Não foi possível conectar. Suas alterações continuam neste formulário; tente salvar novamente.",
      );
    }
  });
  const values = getValues();
  return (
    <>
      <ol className="wizard-steps">
        {["Informações", "Detalhes", "Revisão"].map((label, index) => (
          <li key={label} aria-current={step === index ? "step" : undefined}>
            0{index + 1} · {label}
          </li>
        ))}
      </ol>
      <form
        className="form-card"
        onSubmit={(event) => {
          if (step < 2) {
            event.preventDefault();
            void trigger(stageFields[step]).then((valid) => {
              if (valid) setStep(step + 1);
            });
          } else {
            void submit(event);
          }
        }}
        noValidate
      >
        {step === 0 && (
          <>
            <h2>A história começa pelo imóvel.</h2>
            <div className="form-grid">
              <label className="field full-width">
                Título do imóvel
                <input
                  {...register("title")}
                  placeholder="Ex.: Apartamento com varanda no Jardins"
                  maxLength={160}
                  aria-invalid={!!errors.title}
                />
                {errors.title && (
                  <span className="field-error">{errors.title.message}</span>
                )}
              </label>
              <label className="field">
                Tipo
                <select {...register("type")}>
                  <option value="APARTMENT">Apartamento</option>
                  <option value="HOUSE">Casa</option>
                  <option value="COMMERCIAL">Comercial</option>
                  <option value="LAND">Terreno</option>
                </select>
              </label>
              <label className="field">
                Finalidade
                <select {...register("purpose")}>
                  <option value="SALE">Venda</option>
                  <option value="RENT">Locação</option>
                </select>
              </label>
              <label className="field full-width">
                Descrição
                <textarea
                  {...register("description")}
                  placeholder="O que faz este imóvel especial?"
                  maxLength={5000}
                />
                {errors.description && (
                  <span className="field-error">
                    {errors.description.message}
                  </span>
                )}
              </label>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h2>Os detalhes fazem a diferença.</h2>
            <div className="form-grid">
              <label className="field">
                Cidade
                <input {...register("city")} autoComplete="address-level2" />
                {errors.city && (
                  <span className="field-error">{errors.city.message}</span>
                )}
              </label>
              <label className="field">
                Estado
                <select {...register("state")}>
                  {propertySchema.shape.state.options.map((state) => (
                    <option key={state}>{state}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Bairro
                <input {...register("neighborhood")} />
              </label>
              <label className="field">
                Preço em reais
                <input
                  {...register("price")}
                  inputMode="decimal"
                  placeholder="950000,00"
                />
                {errors.price && (
                  <span className="field-error">{errors.price.message}</span>
                )}
              </label>
              {(
                [
                  { key: "area", label: "Área útil (m²)" },
                  { key: "bedrooms", label: "Quartos" },
                  { key: "bathrooms", label: "Banheiros" },
                  { key: "parkingSpaces", label: "Vagas" },
                ] as const
              ).map((field) => (
                <label className="field" key={field.key}>
                  {field.label}
                  <input
                    type="number"
                    min={0}
                    {...register(field.key, { valueAsNumber: true })}
                  />
                  {errors[field.key] && (
                    <span className="field-error">
                      Informe um número inteiro válido.
                    </span>
                  )}
                </label>
              ))}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h2>Está tudo certo?</h2>
            <dl className="review-grid">
              <div>
                <dt>Imóvel</dt>
                <dd>{values.title}</dd>
              </div>
              <div>
                <dt>Localização</dt>
                <dd>
                  {values.city} · {values.state}
                </dd>
              </div>
              <div>
                <dt>Preço</dt>
                <dd>R$ {values.price}</dd>
              </div>
              <div>
                <dt>Características</dt>
                <dd>
                  {values.area} m² · {values.bedrooms} quartos
                </dd>
              </div>
            </dl>
            <p className="review-note">
              O cadastro será salvo como rascunho. A publicação é feita
              separadamente, quando você estiver pronto. Fotos e tours entrarão
              em uma próxima etapa.
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <span>
            {saved
              ? "Salvo"
              : isSubmitting
                ? "Salvando..."
                : "Salve ao concluir para manter suas alterações."}
          </span>
          {step > 0 && (
            <Button
              type="button"
              variant="quiet"
              disabled={isSubmitting}
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft size={15} />
              Voltar
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {step < 2
              ? "Continuar"
              : isSubmitting
                ? "Salvando..."
                : "Salvar imóvel"}
            {step < 2 ? <ArrowRight size={15} /> : <Check size={15} />}
          </Button>
        </div>
      </form>
    </>
  );
}
