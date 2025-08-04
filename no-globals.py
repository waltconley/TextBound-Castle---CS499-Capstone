import copy
import os


class GameState:
    """
    Encapsulates all the dynamic state of a single player's game.
    """

    def __init__(self):
        # Define the castle structure directly within the GameState initialization
        # This ensures each game instance has its own copy, independent of others.
        self.castle = {
            "Barbican": {
                "East": "Kitchen",
                "South": "Gathering Hall",
                "West": "Outer Ward",
            },
            "Kitchen": {"West": "Barbican", "Item": "Right Leg Of The Forbidden One"},
            "Gathering Hall": {
                "North": "Barbican",
                "East": "Keep",
                "Item": "Left Arm Of The Forbidden One",
            },
            "Keep": {"West": "Gathering Hall", "Item": "Millennium Puzzle Necklace"},
            "Outer Ward": {
                "East": "Barbican",
                "South": "Dungeons",
                "West": "Stables",
                "Item": "Right Arm Of The Forbidden One",
            },
            "Dungeons": {
                "North": "Outer Ward",
                "South": "Catacombs",
                "Item": "Head Of Exodia",
            },
            "Catacombs": {
                "North": "Dungeons",
                "Boss": "Necross",
                "Item": "Your physical body",
            },
            "Stables": {"East": "Outer Ward", "Item": "Left Leg Of The Forbidden One"},
            "Exit": {},
        }

        # Make a copy of the castle for the player's mutable game state
        # This allows items to be removed from a player's map without
        # affecting other players or the original definition.
        self.player_castle = copy.deepcopy(self.castle)

        self.current_room = "Barbican"
        self.inventory = []
        self.update_msg = (
            "Welcome to the Shadow Castle! Find your loot and beat Necross!"
        )
        self.item_acquired_flag = (
            0
        )
        self.game_initialized = False
        self.game_over = False


def clear_screen():
    """
    Clears previous prompts from screen.
    Note: For PyCharm, ensure 'Emulate terminal in output console' is checked
    in Run > Edit Configurations > Edit Configuration Settings > Python.
    """
    os.system("cls" if os.name == "nt" else "clear")


def intro_or_help(game_state: GameState, display: str):
    """
    Will show storyline/help based on the 'display' argument.
    Operates on the provided game_state object.
    """
    if display == "intro":
        print(
            "\n",
            "STORYLINE\n",
            f"{'-' * 27}\n",
            "Yugi has been banished to the Shadow Realm. Kaiba partnered with\n",
            "the evil Maximillion Pegasus and was given the “Soul Prison” card\n",
            "to trap Yugi during their last duel. Luckily, Yugi had on his\n",
            "Millennium Puzzle necklace with him when he was trapped, so Yami\n",
            "is there in spirit, guiding Yugi on how to get out of the Shadow Realm.\n",
            "Bad news, the necklace fell off when Yugi was banished. Yami's\n",
            "instructions are simple, gather for Exodia and the necklace to\n",
            "break out of the Shadow Realm. However, beware of Necross, the zombie\n",
            "guardian of the Shadow Realm. Your mission is daunting, break into\n",
            "the Castle of Necross’ and find the Exodia the Forbidden One (Head \n",
            "of Exodia), Right Arm of The Forbidden One, Left Arm of the Forbidden\n",
            "One, Right Leg of the Forbidden One, Left Leg of the Forbidden One,\n",
            "and the Millennium Puzzle all while avoiding Necross! Once you have\n",
            "all the cards and your necklace, find and defeat Necross to exit the\n",
            "Shadow Realm!\n\n",
        )
        try:
            input("Press enter to continue to instructions.")
        except SyntaxError:
            pass
    elif display == "help":
        print(
            "\n",
            "INSTRUCTIONS\n",
            f"{'-' * 27}\n",
            "To move around the castle type:\n",
            "\tmove ____ or go ____ (replace ____ with cardinal direction).\n\n",
            "To pick up items type:\n",
            "\tget ____ (replace ____ with the full item name including spaces).\n\n",
            "To show the rules type:\n",
            "\thelp\n\n",
            "To quit type:\n",
            "\tquit or exit\n\n",
            "The commands aren't case sensitive so don't worry about that!\n",
        )
        try:
            if game_state.update_msg == "":
                input("Press enter to start the game!")
            else:
                input("Press enter to return to the game!")
        except SyntaxError:
            pass


def show_status(game_state: GameState):
    """
    Displays prevalent information about the current game state.
    Operates on the provided game_state object.
    """
    directions = ""
    item_status = ""
    # Use game_state.player_castle for dynamic item checks
    avail_rooms = list(game_state.player_castle[game_state.current_room].keys())

    # Remove appropriate keys from the newly created list
    if "Item" in avail_rooms:
        avail_rooms.remove("Item")
    if "Boss" in avail_rooms:
        avail_rooms.remove("Boss")

    # Loop through avail_rooms, creating a directions string.
    for i, direction in enumerate(avail_rooms):
        if len(avail_rooms) > 2 and i > 0:
            if i == len(avail_rooms) - 1:
                directions += ", or " + direction
            else:
                directions += ", " + direction
        elif len(avail_rooms) == 2 and i > 0:
            directions += " or " + direction
        else:
            directions = direction

    room_status = ""
    inventory_msg = ""
    possible_movements = ""

    # Logic that determines room status, possible moves, and item updates
    if game_state.current_room == "Exit":
        room_status = "You are exiting the castle."
        inventory_msg = "You dropped all the items in your inventory and give up!"
        possible_movements = ""
        item_status = "Necross laughs at you and taunts you to try again!"
    else:
        if "Boss" in game_state.player_castle[game_state.current_room].keys():
            room_status = f"You are in the {game_state.current_room}. Necross is here!"
            possible_movements = "You can't move. It's time to duel!"
        else:
            room_status = f"You are in the {game_state.current_room}."
            possible_movements = f"You can move {directions.lower()}."

        inventory_msg = f"Inventory: {game_state.inventory}"

        if "Item" in game_state.player_castle[game_state.current_room].keys():
            new_item = game_state.player_castle[game_state.current_room]["Item"]
            if new_item not in game_state.inventory:
                if "Boss" in game_state.player_castle[game_state.current_room].keys():
                    item_status = (
                        f"{new_item} is on the ground! To get it back, beat Necross!"
                    )
                else:
                    item_status = (
                        f"{new_item} is on the ground!",
                        "To pick it up, type 'get {new_item.lower()}'!",
                    )
        else:
            if game_state.item_acquired_flag == 1:
                item_status = game_state.update_msg
                game_state.update_msg = " "  # Reset update_msg after showing
                game_state.item_acquired_flag = 0
            else:
                item_status = "Nothing is on the ground!"

    print(
        f"\n {'-' * 27}\n",
        f"{room_status}\n",
        f"{inventory_msg}\n",
        f"{item_status}\n",
        f"{'-' * 27}\n",
        f"{possible_movements}\n",
        f"{game_state.update_msg}\n",  # Use game_state's update_msg
    )


def get_new_state(game_state: GameState, player_direction: str):
    """
    Updates the player's current room based on their direction input.
    Operates on the provided game_state object.
    """
    if player_direction in game_state.player_castle[game_state.current_room].keys():
        game_state.current_room = game_state.player_castle[game_state.current_room][
            player_direction
        ]
    else:
        game_state.update_msg = (
            f"You can't move {player_direction.lower()},"
            "see above for the directions you can move!"
        )


def pickup(game_state: GameState, ground_item: str):
    """
    Handles item pickup, adding to inventory and removing from the room.
    Operates on the provided game_state object.
    """
    normalized_ground_item = (
        ground_item.title()
    )

    if (
        "Item" in game_state.player_castle[game_state.current_room].keys()
        and normalized_ground_item
        == game_state.player_castle[game_state.current_room]["Item"]
    ):
        actual_item_name = game_state.player_castle[game_state.current_room]["Item"]
        if actual_item_name not in game_state.inventory:
            game_state.inventory.append(actual_item_name)
            del game_state.player_castle[game_state.current_room][
                "Item"
            ]  # Remove from player's castle
            game_state.item_acquired_flag = 1
            game_state.update_msg = f"You have obtained {actual_item_name}!"
        else:
            game_state.update_msg = "You already have this."
    else:
        game_state.update_msg = (
            f"{ground_item} isn't in {game_state.current_room}!",
            " Make sure you spelled it correctly!",
        )


def main():
    """
    Main function to run the game.
    Manages the game loop and state transitions.
    """
    game_state = GameState()  # Create a new instance of GameState for this game session

    # Initial game setup / intro
    intro_or_help(game_state, "intro")
    clear_screen()
    intro_or_help(game_state, "help")
    clear_screen()

    # Gameplay loop initializes here
    while True:
        clear_screen()

        # Check at beginning of loop for game ending conditions
        if game_state.current_room == "Exit":
            game_state.update_msg = "Thanks for playing! Hope you enjoyed it!"
            game_state.game_over = True

        # Boss Detection - win or lose
        if "Boss" in game_state.player_castle[game_state.current_room].keys():
            if len(game_state.inventory) < 6:
                game_state.update_msg = (
                    "You have been defeated by Necross! You didn't have all the Exodia "
                    "pieces and the necklace! You're stuck in the Shadow Realm!\n "
                    "Thank you for playing! Hope you enjoyed it!"
                )
            else:
                game_state.update_msg = (
                    "You used your necklace and Exodia pieces to beat Necross and exit "
                    "the Shadow Realm! Make sure Kaiba and Pegasus pay for this!\n "
                    "Thank you for playing! Hope you enjoyed it!"
                )
            game_state.game_over = True

        show_status(game_state)

        if game_state.game_over:
            break

        # Reset update_msg so the message clears out if it isn't needed.
        game_state.update_msg = ""

        # Starting to observe user input (go/help/exit), first word for if statement.
        player_input = input(
            "Enter your command: "
        ).lower()  # Convert input to lowercase immediately
        player_split = player_input.split(" ")
        player_action = player_split[
            0
        ]

        # Logic branching using if/elif/else - movement
        if player_action in ["move", "go"]:
            if len(player_split) > 1:
                # Capitalize only the first letter of the direction for dict
                player_direction = player_split[1].capitalize()
                get_new_state(
                    game_state, player_direction
                )  # Pass the game_state object
            else:
                game_state.update_msg = "You need a direction!"
            continue

        # Picking up item on ground.
        elif player_action == "get":
            ground_item = " ".join(
                player_split[1:]
            )
            if (
                len(player_split) > 1 and ground_item.strip() != ""
            ):
                pickup(game_state, ground_item)
            else:
                game_state.update_msg = (
                    "You can't pick up thin air. "
                    "Include the item name (ex. get fish tacos)."
                )
            continue

        # Player input help, clears screen and shows instructions again.
        elif player_action == "help":
            clear_screen()
            game_state.update_msg = (
                " "
            )
            intro_or_help(game_state, "help")  # Pass the game_state object
            continue

        # Playing input exit or quit.
        elif player_action in ["exit", "quit"]:
            game_state.current_room = "Exit"  # Modify game_state's current_room
            continue

        # Default, no match case on player input.
        else:
            game_state.update_msg = (
                "Error: Invalid command. Type 'help' if you need assistance."
            )


if __name__ == "__main__":
    main()
