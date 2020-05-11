Backend code for the Indorphins video chat application

** Setup instructions and more to be added upon release **

[![Indorphins](https://circleci.com/gh/afloesch/indorphins-be.svg?style=shield&circle-token=3b155ba273361607512a7c628217c4ca2394de5c)](https://app.circleci.com/pipelines/github/afloesch/indorphins-be)

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.<br />
Open [http://localhost:3001](http://localhost:3001) to view it in the browser.

Production server running on:[http://indorphins-be-lb-661510815.us-east-1.elb.amazonaws.com](http://indorphins-be-lb-661510815.us-east-1.elb.amazonaws.com)

## Connecting to PostgreSQL via Command Line (GUI)

#### Install PostgreSQL

Follow this [link](https://www.postgresql.org/download/) to download the PostgreSQL installer on your machine:

- Select your OS.

  - Mac (with Homebrew): run the command `brew install postgresql`. (recommended)
  - Mac (w/o Homebrew) & Windows: Use the Interactive installer by EnterpriseDB. You can skip the 'Stack Builder' add-on.

- Go to your terminal and verify that you can run the psql command: `psql --version`

- If the psql command isn't recognized, you'll need to add it to your PATH.
  - Linux and Mac: add the line `export PATH=$PATH:/Library/PostgreSQL/latest/bin` to your `~/.bashrc` or `~/.bash_profile`, respectively, and restart your terminal. The exact path may vary so be sure to confirm the location of the postgresql binaries.
  - Windows: go to the advanced system settings to modify the PATH environmental variable to include the `bin` directory within the postgresql install directory.

#### Log in to the database

Log in to the database from the command line in your terminal. Just type:

### `psql postgres://vogevbto:CzupjdSeT8NNNL5hCamhOL2bx7fuUHH_@drona.db.elephantsql.com:5432/vogevbto`

You'll find yourself at different command prompt. That means you're in the database and you can start writing SQL queries.

        * Try typing `\d` to see a list of the different tables.

        * Then try seeing what a specific table looks like by typing `\d TABLE_NAME`

        * We can always quit out of here by typing `\q`.

        * We can type `\?` to get help on other commands and querys too

        * Make sure you finish each query with a semicolon`;`

You may also find this [SQL cheat sheet](http://www.cheat-sheets.org/saved-copy/sqlcheetsheet.gif) useful.
