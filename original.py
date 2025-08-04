# Walter Conley
# Edit pycharm settings so that clear_screen functions while running in IDE.
# # Run > Edit Configurations > Edit Configuration Settings > Python
# # Check 'Emulate terminal in output console
import os

# Global variables
# A dictionary for the castle
# The dictionary links a room to other rooms and contains items + boss info.
castle = {
    "Barbican": {"East": "Kitchen", "South": "Gathering Hall", "West": "Outer Ward"},
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
    "Dungeons": {"North": "Outer Ward", "South": "Catacombs", "Item": "Head Of Exodia"},
    "Catacombs": {"North": "Dungeons", "Boss": "Necross", "Item": "Your physical body"},
    "Stables": {"East": "Outer Ward", "Item": "Left Leg Of The Forbidden One"},
    "Exit": {},
}

# List containing player's inventory
inventory = []

# String variables containing important player updates
update_msg = ""
item_acquired = ""


# Clears previous prompts from screen.
# See note at top of file to ensure it works correctly!
def clear_screen():
    os.system("cls" if os.name == "nt" else "clear")


# Will show storyline/help.
def intro_or_help(display):
    global update_msg
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
            "guardian of the Shadow Realm.  Your mission is daunting, break into\n",
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
            if update_msg == "":
                input("Press enter to start the game!")
            else:
                input("Press enter to return to the game!")
        except SyntaxError:
            pass


# Function that displays prevalent information every time it's called
def show_status(current_room):
    global update_msg, item_acquired, inventory

    # Logic that determines possible moves from current room
    directions = ""
    item_status = ""
    # Grab the keys from the castle[current_room] and convert it to an individual list
    avail_rooms = list(castle[current_room].keys())

    # Remove appropriate keys from the newly created list
    if "Item" in avail_rooms:
        avail_rooms.remove("Item")
    if "Boss" in avail_rooms:
        avail_rooms.remove("Boss")

    # Loop through avail_room, creating a directions string.
    for direction in avail_rooms:
        if len(avail_rooms) > 2 and directions != "":
            if direction == avail_rooms[-1]:
                directions = directions + ", or " + direction
            else:
                directions = directions + ", " + direction
        elif len(avail_rooms) == 2 and directions != "":
            directions = directions + " or " + direction
        else:
            directions = direction

    # Logic that determines room status, possible moves, and item updates
    if current_room == "Exit":
        room_status = "You are exiting the castle."
        inventory_msg = "You dropped all the items in your inventory and give up!"
        possible_movements = ""
        item_status = "Necross laughs at you and taunts you to try again!"
    else:
        # Instead of calling elif current_room =='Catacombs'
        # I will be future proofing in the event the boss changes room
        # in the future. Check current room keys for 'Boss'
        if "Boss" in castle[current_room].keys():
            room_status = f"You are in the {current_room}. Necross is here!"
            possible_movements = "You can't move. It's time to duel!"
        else:
            room_status = f"You are in the {current_room}."
            possible_movements = f"You can move {directions.lower()}."

        inventory_msg = f"Inventory: {inventory}"

        if "Item" in castle[current_room].keys():
            new_item = castle[current_room]["Item"]
            if new_item not in inventory:
                if "Boss" in castle[current_room].keys():
                    item_status = (
                        f"{new_item} is on the ground! To get it back, beat Necross!"
                    )
                else:
                    item_status = (
                        f"{new_item} is on the ground! To pick it up, type 'get item'!"
                    )
        else:
            if item_acquired == 1:
                item_status = update_msg
                update_msg = " "
                item_acquired = 0
            else:
                item_status = "Nothing is on the ground!"

    print(
        f"\n {'-' * 27}\n",
        f"{room_status}\n",
        f"{inventory_msg}\n",
        f"{item_status}\n",
        f"{'-' * 27}\n",
        f"{possible_movements}\n",
        f"{update_msg}\n",
    )


def get_new_state(current_room, player_direction):
    global update_msg
    # Ensures player inputs a valid direction and not blank or invalid
    # Ex. 'Go '
    if player_direction in castle[current_room].keys():
        current_room = castle[current_room][player_direction]
    else:
        update_msg = (
            f"You can't move {player_direction.lower()},"
            "see above for the directions you can move!"
        )

    return current_room


# Item pickup function
# Adds to inventory and removes item to prevent duplicates
# Still leaving in the duplicate prevention code to future-proof.
def pickup(current_room, ground_item):
    global update_msg, item_acquired
    if (
        "Item" in castle[current_room].keys()
        and ground_item == castle[current_room]["Item"]
    ):
        if ground_item not in inventory:
            inventory.append(castle[current_room]["Item"])
            del castle[current_room]["Item"]
            item_acquired = 1
            update_msg = f"You have obtained {ground_item}!"
        else:
            # Should never get here, but future proofing
            update_msg = "You already have this."
    # picking up non-existent item
    else:
        update_msg = (
            f"{ground_item} isn't in {current_room}!Make sure you spelled it correctly!"
        )


def main():
    global update_msg
    # Cleans away the introduction (will eventually be storyline) & instructions
    intro_or_help("intro")
    clear_screen()
    intro_or_help("help")
    clear_screen()
    # Initializes player starting room.
    current_room = "Barbican"
    update_msg = "Welcome to the Shadow Castle! Find your loot and beat Necross!"
    # Set a variable that will be set to True if the conditions are met
    game_over = False

    # Gameplay loop initializes here
    while True:
        # Wipes the terminal every loop, keeps it clean.
        clear_screen()

        # Check at beginning of loop for game ending conditions
        # If the user quits the game
        if current_room == "Exit":
            update_msg = "Thanks for playing! Hope you enjoyed it!"
            game_over = True

        # Boss Detection - win or lose
        # Don't want to check current_room value in the event boss moves rooms.
        if "Boss" in castle[current_room].keys():
            if len(inventory) < 6:
                update_msg = (
                    "You have been defeated by Necross! You didn't have all the Exodia "
                    "pieces and the necklace! You're stuck in the Shadow Realm!\n "
                    "Thank you for playing! Hope you enjoyed it!"
                )
            else:
                # Uses all inventory items to beat Necross and win game
                update_msg = (
                    "You used your necklace and Exodia pieces to beat Necross and exit "
                    "the Shadow Realm! Make sure Kaiba and Pegasus pay for this!\n "
                    "Thank you for playing! Hope you enjoyed it!"
                )
            game_over = True

        # Function to show player state (location and possible movements
        show_status(current_room)
        if game_over:
            break

        # Resets update_msg so the message clears out if it isn't needed.
        update_msg = ""

        # Starting to observe user input (go/help/exit), first word for if statement.
        player_input = input("Enter your command: ")
        player_split = player_input.split(" ")
        player_action = player_split[0].title()

        # Logic branching using python's case statement - movement
        if player_action == "Move" or player_action == "Go":
            # Ensures the player includes a direction
            if len(player_split) > 1:
                # Prevents any case-type errors with .title()
                player_direction = player_split[1].title()
                current_room = get_new_state(current_room, player_direction)
            else:
                update_msg = "You need a direction!"
            continue

        # Picking up item on ground.
        elif player_action == "Get":
            ground_item = " ".join(player_split[1:]).title()
            if len(player_split) > 1 and ground_item != "":
                pickup(current_room, ground_item)
            else:
                update_msg = (
                    "You can't pick up thin air."
                    "Include the item name (ex. get fish tacos)."
                )
            continue

        # Player input help, clears screen and shows instructions again.
        elif player_action == "Help":
            clear_screen()
            # Changes update_msg so that it'll show return to game instead of start game
            # Yay for reusing code!
            update_msg = " "
            intro_or_help("help")
            continue

        # Playing input exit or quit.
        elif player_action == "Exit" or player_action == "Quit":
            # Set current_room to Exit, the beginning of the loop will catch and exit.
            current_room = "Exit"
            continue

        # Default, no match case on player input.
        else:
            update_msg = "Error: Invalid command. Type 'help' if you need assistance."


main()
