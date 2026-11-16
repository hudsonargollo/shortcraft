import VascularHero from "./components/VascularHero";

export default function HomePage() {
  return (
    <>
      <VascularHero />
      <section id="contato" className="contact">
        <h2 className="contact__title">Agendar consulta</h2>
        <p className="contact__lede">
          Preencha o formulário e retornaremos em até 24 horas úteis.
        </p>
        <a href="mailto: consultório@drherlonmoura.com" className="button">
          Escrever para o consultório
        </a>
      </section>
    </>
  );
}
