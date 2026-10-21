# Perfis de Acesso e Permissoes

O EcollTruck organiza o acesso as paginas de acordo com a conta informada na tela de entrada.

## Perfil Administrador
Possui acesso completo a todas as telas do sistema.
- Painel Principal (index.html)
- Gestao de Frota (paginas/caminhoes.html)
- Gestao de Usuarios (paginas/usuarios.html)
- Monitoramento no Mapa (paginas/monitoramento.html)
- Execucao de Rotas (paginas/rotas.html)
- Registro de Pesagem (paginas/registro-peso.html)
- Relatorios e Logs do Sistema

## Perfil Operador
Voltado para a equipe de controle e balanca.
- Monitoramento no Mapa (paginas/monitoramento.html)
- Registro de Pesagem (paginas/registro-peso.html)
- Execucao de Rotas (paginas/rotas.html)

## Perfil Motorista
Voltado exclusivamente para o trabalho de campo.
- Execucao de Rotas (paginas/rotas.html)
- Registro de Pesagem (paginas/registro-peso.html)

## Regras de Seguranca
Se um usuario tentar acessar diretamente uma pagina fora do seu perfil:
- Motoristas sao redirecionados para a tela de rotas.
- Operadores sao redirecionados para a tela de monitoramento.
- Contas nao conectadas sao enviadas para a tela de login.