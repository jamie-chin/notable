import axios from "axios";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

const ViewNotes = () => {
	const [presentations, setPresentations] = useState<any[]>([]);
	useEffect(() => {
		fetchNotesSet();
	}, []);

	const fetchNotesSet = () => {
		axios
			.get("/api/presentations", {
				headers: {
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
			})
			.then((res) => {
				console.log(res);
				setPresentations(res.data);
			})
			.catch((err) => {
				console.log(err);
			});

		axios.get(
			`/api/get_userNotes?presentationId=${presentations[0].presentation_instance_id}`,
			{
				headers: {
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
			}
		);
	};

	return (
		<div>
			<h1>View Notes</h1>
			<div id="noteSets_container">
				{presentations.map((presentation) => (
					<Link to="/pdf" state={{ presentations: "presentations" }} id="noteSet">
						{/* result array in result.data or result.rows */}
						<p>{presentation.title}</p>
                        {/* <p>{presentation.presentation_id}</p> */}
					</Link>
				))}
			</div>
		</div>
	);
};
export default ViewNotes;
